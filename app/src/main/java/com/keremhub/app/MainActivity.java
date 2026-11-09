package com.keremhub.app;

import android.app.*;
import android.content.*;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.function.*;

public final class MainActivity extends Activity {
    public int bg=0xff141522,surface=0xff262637,ink=0xfff7f7fd,muted=0xffb4b5c9,accent=0xffb2b0f6;
    public volatile int generation=0;
    public Api api;
    public LinearLayout root,body;
    public ScrollView scroll;
    private Runnable current,cleanup;
    private final ArrayDeque<Runnable> history=new ArrayDeque<>();
    private android.content.SharedPreferences prefs;
    private Upload pendingUpload;
    private boolean editing=false;
    private JSONArray sites=new JSONArray();
    private PlayerScreen player;
    private boolean portalVisible;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Map<String,Typeface> fonts=new HashMap<>();
    public Typeface font(String family,int weight){String key=family+weight;Typeface cached=fonts.get(key);if(cached!=null)return cached;try{Typeface.Builder builder=new Typeface.Builder(getAssets(),"fonts/"+family+".ttf").setWeight(weight);if(!family.equals("bebas"))builder.setFontVariationSettings("'wght' "+weight);Typeface face=builder.build();fonts.put(key,face);return face;}catch(Exception e){return Typeface.create("sans-serif",weight>=600?Typeface.BOLD:Typeface.NORMAL);}}
    public void hub(){history.clear();home();}

    @Override public void onCreate(Bundle state){super.onCreate(state);prefs=getSharedPreferences("keremhub",MODE_PRIVATE);api=new Api(this);home();}
    public String base(){return prefs.getString("server","http://192.168.1.240").replaceAll("/+$","");}
    public void theme(int b,int s,int i,int m,int ac){bg=b;surface=s;ink=i;muted=m;accent=ac;getWindow().setStatusBarColor(b);getWindow().setNavigationBarColor(b);int flags=Color.luminance(b)>.5?View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0;getWindow().getDecorView().setSystemUiVisibility(flags);}
    public int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    public LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
    public LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.HORIZONTAL);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    public GradientDrawable shape(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    public TextView text(String s,int sp,int color){TextView t=new TextView(this);t.setText(s==null||s.equals("null")?"":s);t.setTextSize(sp);t.setTextColor(color);t.setTypeface(font("inter",400));t.setIncludeFontPadding(false);t.setFontFeatureSettings("kern");t.setLineSpacing(dp(2),1.05f);return t;}
    public void space(LinearLayout p,int h){View v=new View(this);p.addView(v,new LinearLayout.LayoutParams(1,dp(h)));}
    public TextView heading(LinearLayout p,String s){TextView t=text(s,23,ink);t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(22),0,dp(12));p.addView(t,lp);return t;}
    public void note(LinearLayout p,String s){TextView t=text(s,13,muted);t.setPadding(0,dp(7),0,dp(9));p.addView(t);}
    public LinearLayout card(LinearLayout p){LinearLayout c=column();c.setPadding(dp(18),dp(18),dp(18),dp(18));GradientDrawable d=shape(surface,20);d.setStroke(dp(1),Color.luminance(bg)>.5?0xffe8ebf0:0x16ffffff);c.setBackground(d);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(6),0,dp(7));p.addView(c,lp);return c;}
    public TextView button(LinearLayout p,String label,Runnable click){TextView t=text(label,14,ink);t.setGravity(Gravity.CENTER);t.setMinHeight(dp(48));t.setPadding(dp(16),dp(12),dp(16),dp(12));t.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));GradientDrawable d=shape(Color.luminance(bg)>.5?0xffedf2ff:0x14ffffff,13);t.setBackground(new RippleDrawable(ColorStateList.valueOf(0x33b2b0f6),d,null));LinearLayout.LayoutParams lp=p.getOrientation()==LinearLayout.HORIZONTAL?new LinearLayout.LayoutParams(0,-2,1):new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(5),p.getOrientation()==LinearLayout.HORIZONTAL?dp(5):0,dp(5));p.addView(t,lp);t.setOnClickListener(v->{v.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK);click.run();});return t;}
    public void chips(LinearLayout p,String[] labels,int selected,IntConsumer clicked){HorizontalScrollView h=new HorizontalScrollView(this);h.setHorizontalScrollBarEnabled(false);LinearLayout r=row();for(int i=0;i<labels.length;i++){final int idx=i;TextView t=text(labels[i],13,i==selected?(Color.luminance(accent)>.5?0xff141522:Color.WHITE):muted);t.setGravity(Gravity.CENTER);t.setPadding(dp(17),dp(11),dp(17),dp(11));t.setMinHeight(dp(45));t.setBackground(shape(i==selected?accent:surface,24));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);lp.setMargins(0,dp(4),dp(7),dp(6));r.addView(t,lp);t.setOnClickListener(v->clicked.accept(idx));}h.addView(r);p.addView(h);}
    public LinearLayout page(String title,String subtitle){
        portalVisible=false;
        if(cleanup!=null){Runnable c=cleanup;cleanup=null;c.run();}generation++;player=null;
        root=column();root.setBackgroundColor(bg);root.setFitsSystemWindows(true);setContentView(root);
        LinearLayout bar=row();bar.setPadding(dp(10),dp(7),dp(14),dp(7));bar.setMinimumHeight(dp(64));
        TextView back=text(history.isEmpty()?"⌂":"‹",32,ink);back.setGravity(Gravity.CENTER);bar.addView(back,new LinearLayout.LayoutParams(dp(46),dp(48)));back.setContentDescription("Geri / Keremhub");back.setOnClickListener(v->{if(history.isEmpty())home();else back();});
        LinearLayout names=column();TextView name=text(title,20,ink);name.setTypeface(Typeface.create("sans-serif-medium",0));names.addView(name);if(subtitle!=null&&!subtitle.trim().isEmpty())names.addView(text(subtitle,11,muted));bar.addView(names,new LinearLayout.LayoutParams(0,-2,1));
        TextView hub=text("k.",24,accent);hub.setGravity(Gravity.CENTER);bar.addView(hub,new LinearLayout.LayoutParams(dp(46),dp(48)));hub.setContentDescription("Keremhub ana sayfa");hub.setOnClickListener(v->{history.clear();home();});root.addView(bar);
        scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setClipToPadding(false);scroll.setVerticalScrollBarEnabled(false);body=column();body.setPadding(dp(20),dp(8),dp(20),dp(36));scroll.addView(body,new ScrollView.LayoutParams(-1,-2));root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(prefs.getBoolean("motion",true)){body.setAlpha(0);body.setTranslationY(dp(9));body.animate().alpha(1).translationY(0).setDuration(190).start();}return body;
    }
    public void remember(Runnable r){current=r;}
    public void onPageCleanup(Runnable r){cleanup=r;}
    public void navigate(Runnable r){if(current!=null)history.push(current);r.run();}
    public void back(){if(!history.isEmpty())history.pop().run();else finish();}
    @Override public void onBackPressed(){if(player!=null&&player.handleBack())return;back();}
    @Override public boolean dispatchKeyEvent(KeyEvent event){if(player!=null&&player.key(event.getKeyCode(),event))return true;return super.dispatchKeyEvent(event);}
    @Override public void onConfigurationChanged(android.content.res.Configuration config){super.onConfigurationChanged(config);if(player!=null)player.configurationChanged();else if(portalVisible)home();}
    public void get(String p,Consumer<JSONObject> done){api.request("GET",p,null,v->{if(v instanceof JSONObject)done.accept((JSONObject)v);else failure("Sunucudan beklenen yanıt alınamadı.");});}
    public void getArray(String p,Consumer<JSONArray> done){api.request("GET",p,null,v->{if(v instanceof JSONArray)done.accept((JSONArray)v);else failure("Sunucudan beklenen liste alınamadı.");});}
    public void request(String method,String path,JSONObject data,Consumer<JSONObject> done){api.request(method,path,data,v->done.accept(v instanceof JSONObject?(JSONObject)v:obj("items",v)));}
    public JSONObject obj(Object... pairs){JSONObject j=new JSONObject();try{for(int i=0;i+1<pairs.length;i+=2)j.put(String.valueOf(pairs[i]),pairs[i+1]==null?JSONObject.NULL:pairs[i+1]);}catch(JSONException e){throw new IllegalArgumentException(e);}return j;}
    public String enc(String s){try{return URLEncoder.encode(s==null?"":s,"UTF-8");}catch(java.io.UnsupportedEncodingException e){throw new AssertionError(e);}}
    public String bytes(double n){if(n<1024)return String.format(Locale.US,"%.0f B",n);String[] units={"KB","MB","GB","TB"};int i=0;n/=1024;while(n>=1024&&i<3){n/=1024;i++;}return String.format(Locale.forLanguageTag("tr"),"%.1f %s",n,units[i]);}
    public void toast(String m){Toast.makeText(this,m==null?"İşlem tamamlanamadı.":m,Toast.LENGTH_LONG).show();}
    public void failure(String m){toast(m);if(body!=null){LinearLayout c=card(body);note(c,"Bağlantı / işlem hatası\n"+(m==null?"Sunucuya ulaşılamadı. Aynı yerel ağa bağlı olduğunu kontrol et.":m));button(c,"Tekrar dene",()->{if(current!=null)current.run();});}}
    public void confirm(String t,String m,Runnable yes){new AlertDialog.Builder(this).setTitle(t).setMessage(m).setNegativeButton("Vazgeç",null).setPositiveButton("Onayla",(d,w)->yes.run()).show();}
    public void prompt(String title,String initial,Consumer<String> answer){form(title,new String[]{title},new String[]{initial},v->answer.accept(v[0]));}
    public void choose(String t,String[] options,IntConsumer selected){new AlertDialog.Builder(this).setTitle(t).setItems(options,(d,w)->selected.accept(w)).setNegativeButton("Vazgeç",null).show();}
    public void form(String title,String[] labels,String[] values,Consumer<String[]> done){LinearLayout fields=column();fields.setPadding(dp(22),dp(8),dp(22),dp(8));EditText[] inputs=new EditText[labels.length];for(int i=0;i<labels.length;i++){TextView l=text(labels[i],12,0xffbbbbcc);fields.addView(l);EditText e=new EditText(this);e.setText(i<values.length?values[i]:"");e.setSingleLine(false);e.setTextSize(15);e.setMinHeight(dp(48));fields.addView(e);inputs[i]=e;}ScrollView s=new ScrollView(this);s.addView(fields);AlertDialog d=new AlertDialog.Builder(this).setTitle(title).setView(s).setNegativeButton("Vazgeç",null).setPositiveButton("Kaydet",null).create();d.setOnShowListener(v->d.getButton(-1).setOnClickListener(b->{String[] result=new String[inputs.length];for(int i=0;i<result.length;i++)result[i]=inputs[i].getText().toString().trim();d.dismiss();done.accept(result);}));d.show();}
    public void search(LinearLayout p,String hint,Consumer<String> submit){LinearLayout r=row();EditText e=new EditText(this);e.setSingleLine(true);e.setTextSize(14);e.setTextColor(ink);e.setHintTextColor(muted);e.setHint(hint);e.setPadding(dp(14),dp(12),dp(14),dp(12));e.setBackground(shape(surface,14));e.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);r.addView(e,new LinearLayout.LayoutParams(0,dp(50),1));TextView go=text("Ara",14,accent);go.setGravity(Gravity.CENTER);r.addView(go,new LinearLayout.LayoutParams(dp(56),dp(50)));Runnable run=()->{((InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(e.getWindowToken(),0);e.clearFocus();submit.accept(e.getText().toString().trim());};go.setOnClickListener(v->run.run());e.setOnEditorActionListener((v,id,event)->{run.run();return true;});p.addView(r);space(p,10);}
    public void image(LinearLayout p,String url,int h,Runnable clicked){
        ImageView v=new ImageView(this);v.setScaleType(ImageView.ScaleType.CENTER_CROP);v.setBackground(shape(surface,8));v.setClipToOutline(true);p.addView(v,new LinearLayout.LayoutParams(-1,dp(h)));
        final boolean[] started={false};final android.graphics.Rect visible=new android.graphics.Rect();
        android.view.ViewTreeObserver.OnPreDrawListener loader=()->{
            if(!started[0]&&v.isShown()&&v.getGlobalVisibleRect(visible)){
                started[0]=true;
                api.image(url,Math.min(1000,Math.max(dp(h),p.getLayoutParams()!=null&&p.getLayoutParams().width>0?p.getLayoutParams().width:getResources().getDisplayMetrics().widthPixels)),b->{v.setImageBitmap(b);v.setImageAlpha(255);v.setAlpha(1f);});
            }return true;
        };
        v.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View view){v.getViewTreeObserver().addOnPreDrawListener(loader);}public void onViewDetachedFromWindow(View view){if(v.getViewTreeObserver().isAlive())v.getViewTreeObserver().removeOnPreDrawListener(loader);}});
        if(v.isAttachedToWindow())v.getViewTreeObserver().addOnPreDrawListener(loader);
        if(clicked!=null)v.setOnClickListener(w->clicked.run());
    }
    public void posterRow(LinearLayout p,JSONArray items,Consumer<JSONObject> clicked){if(items==null||items.length()==0){note(p,"Henüz içerik yok.");return;}HorizontalScrollView sc=new HorizontalScrollView(this);sc.setHorizontalScrollBarEnabled(false);LinearLayout r=row();for(int i=0;i<items.length();i++){JSONObject o=items.optJSONObject(i);if(o==null)continue;LinearLayout tile=column();LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(dp(125),-2);lp.setMargins(0,0,dp(12),0);r.addView(tile,lp);String url=o.optString("posterUrl",o.optString("coverUrl",o.optString("thumbUrl","")));image(tile,url,174,()->clicked.accept(o));TextView t=text(o.optString("title",o.optString("name","İsimsiz")),13,ink);t.setMaxLines(2);t.setEllipsize(android.text.TextUtils.TruncateAt.END);t.setPadding(0,dp(9),0,0);tile.addView(t);String sub=o.optString("author",o.optString("year",""));tile.addView(text(sub,11,muted));if(o.has("progress")&&!o.isNull("progress")){ProgressBar progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setProgressTintList(ColorStateList.valueOf(accent));progress.setProgress((int)(100*o.optDouble("progress",0)));tile.addView(progress,new LinearLayout.LayoutParams(-1,dp(4)));}tile.setOnClickListener(v->clicked.accept(o));}sc.addView(r);p.addView(sc);}

    public void home(){
        theme(0xff141522,0xff262637,0xfff7f7fd,0xffb4b5c9,0xffb2b0f6);
        LinearLayout p=page("Keremhub","");portalVisible=true;remember(this::home);
        root.getChildAt(0).setVisibility(View.GONE);
        int width=getResources().getConfiguration().screenWidthDp;
        int side=width<=390?16:width<=760?20:36;
        p.setPadding(dp(side),0,dp(side),dp(28));
        GradientDrawable wash=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xff35334e,0xff141522,0xff1d2335});root.setBackground(wash);
        api.image("/wallpaper.webp",1600,b->{
            android.graphics.drawable.BitmapDrawable wallpaper=new android.graphics.drawable.BitmapDrawable(getResources(),b);
            wallpaper.setGravity(Gravity.FILL);root.setBackground(wallpaper);
        });
        LinearLayout desktopTop=row();desktopTop.setPadding(dp(side),0,dp(side),0);
        ImageView mark=new ImageView(this);mark.setImageResource(com.keremhub.app.R.drawable.keremhub_mark);mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        desktopTop.addView(mark,new LinearLayout.LayoutParams(dp(34),dp(34)));
        mark.setContentDescription("Uygulama ayarları");mark.setOnClickListener(v->navigate(this::settings));
        TextView personal=text("Kişisel alanın.",width<=390?10:12,0xffb4b5c9);
        LinearLayout.LayoutParams personalLp=new LinearLayout.LayoutParams(0,-2,1);personalLp.leftMargin=dp(10);desktopTop.addView(personal,personalLp);
        TextView edit=text(editing?"✓  Bitti":"✎  Düzenle",12,ink);edit.setPadding(dp(14),dp(9),dp(14),dp(9));
        edit.setBackground(Ui.border(this,0x09ffffff,0x20ffffff,11));edit.setOnClickListener(v->{editing=!editing;home();});desktopTop.addView(edit);
        root.addView(desktopTop,0,new LinearLayout.LayoutParams(-1,dp(width<=760?76:96)));
        p.setGravity(Gravity.CENTER_HORIZONTAL);
        // Match the site's centered launchpad, while allowing small landscape screens to scroll.
        p.setMinimumHeight(dp(Math.max(0,getResources().getConfiguration().screenHeightDp-(width<=760?201:206))));
        space(p,width<=760?20:18);
        TextView eye=text("HER ŞEY YERLİ YERİNDE",8,muted);eye.setLetterSpacing(.3f);eye.setGravity(Gravity.CENTER);p.addView(eye);space(p,15);
        TextView title=text("Keremhub.",width<=390?42:width<=760?46:Math.round(Math.max(40,Math.min(66,width*.052f))),ink);
        title.setTypeface(font("inter",600));title.setLetterSpacing(-.065f);title.setGravity(Gravity.CENTER);p.addView(title);
        TextView welcome=text("Küçük bir cihaz. Kocaman bir dünya.",width<=760?12:14,0xffb9b9cf);welcome.setGravity(Gravity.CENTER);p.addView(welcome);space(p,width<=390?28:34);
        LinearLayout shelf=column();shelf.setPadding(dp(width<=390?17:width<=760?15:40),dp(width<=390?25:width<=760?28:34),dp(width<=390?17:width<=760?15:40),dp(width<=760?22:27));
        shelf.setBackground(Ui.border(this,0x0dffffff,0x25ffffff,27));
        LinearLayout.LayoutParams shelfLp=new LinearLayout.LayoutParams(-1,-2);p.addView(shelf,shelfLp);
        TextView caption=text("Siteler kontrol ediliyor  ·  Sana ait, sana özel.",9,muted);caption.setGravity(Gravity.CENTER);caption.setPadding(0,dp(25),0,0);p.addView(caption);
        if(sites.length()>0)renderSites(shelf,sites);else note(shelf,"Servisler yükleniyor…");
        getArray("/api/siteler",arr->{
            sites=arr;shelf.removeAllViews();renderSites(shelf,arr);
            get("/api/durum",status->{int active=0,online=0;for(int i=0;i<arr.length();i++){JSONObject site=arr.optJSONObject(i);if(site!=null&&site.optBoolean("aktif",true)){active++;if(status.optBoolean(String.valueOf(site.optInt("id"))))online++;}}
                caption.setText((online==active?"Tüm uygulamalar hazır":online+" / "+active+" uygulama çevrimiçi")+"  ·  Sana ait, sana özel.");
                for(int i=0;i<shelf.getChildCount();i++){View row=shelf.getChildAt(i);if(!(row instanceof LinearLayout))continue;for(int j=0;j<((LinearLayout)row).getChildCount();j++){View tile=((LinearLayout)row).getChildAt(j);if(!(tile.getTag() instanceof Integer))continue;TextView dot=tile.findViewWithTag("dot");if(dot!=null){boolean up=status.optBoolean(String.valueOf(tile.getTag()),false);dot.setTextColor(up?0xff91e5bd:0xffffb08c);dot.setContentDescription(up?"Çevrimiçi":"Ulaşılamıyor");}}}
            });
        });
        LinearLayout footer=row();footer.setPadding(dp(14),dp(7),dp(14),dp(7));
        footer.setBackground(Ui.border(this,0xff292938,0x25ffffff,15));
        View pi=Ui.icon(this,"drive",30,accent,()->navigate(this::system));pi.setContentDescription("Sistem bilgileri");footer.addView(pi);
        TextView metrics=text("—°   —%",11,ink);LinearLayout.LayoutParams ml=new LinearLayout.LayoutParams(0,dp(38),1);metrics.setGravity(Gravity.CENTER);footer.addView(metrics,ml);metrics.setOnClickListener(v->navigate(this::system));
        TextView clock=text(new java.text.SimpleDateFormat("HH:mm",Locale.forLanguageTag("tr")).format(new Date()),11,ink);footer.addView(clock);
        View settings=Ui.icon(this,"filter",32,muted,()->navigate(this::settings));settings.setContentDescription("Ayarlar");footer.addView(settings);
        LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(52));fp.setMargins(dp(12),0,dp(12),dp(12));root.addView(footer,fp);
        get("/api/sistem",j->{double total=j.optDouble("bellekToplam",0),used=total-j.optDouble("bellekBos",0);metrics.setText(j.optString("sicaklik","—")+"°   "+(total>0?"%"+Math.round(used*100/total):"—"));});
    }
    private void renderSites(LinearLayout shelf,JSONArray arr){
        int width=getResources().getConfiguration().screenWidthDp;
        int side=width<=390?16:width<=760?20:36,inside=width<=390?17:width<=760?15:40;
        int gap=width<=390?10:width<=760?12:34;
        int available=width-side*2-inside*2;
        int columns=width<=390?2:width<=760?3:Math.max(1,Math.min(4,(available+gap)/(154+gap)));
        int itemWidth=width<=760?(available-gap*(columns-1))/columns:154;
        LinearLayout r=null;int visible=0;
        for(int i=0;i<arr.length();i++){
            JSONObject s=arr.optJSONObject(i);if(s==null||(!editing&&!s.optBoolean("aktif",true)))continue;
            if(visible%columns==0){r=row();r.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);if(visible>0)rp.topMargin=dp(23);shelf.addView(r,rp);}
            visible++;LinearLayout tile=column();tile.setGravity(Gravity.CENTER_HORIZONTAL);tile.setTag(Integer.valueOf(s.optInt("id")));LinearLayout.LayoutParams tileLp=new LinearLayout.LayoutParams(dp(itemWidth),-2);if(visible%columns!=0)tileLp.rightMargin=dp(gap);r.addView(tile,tileLp);
            int color=accent;try{color=Color.parseColor(s.optString("renk"));}catch(Exception ignored){}
            FrameLayout stage=new FrameLayout(this);int icon=width<=390?92:width<=760?90:116;tile.addView(stage,new LinearLayout.LayoutParams(dp(icon),dp(icon)));
            stage.addView(new ServiceIcon(this,s.optString("yol"),color),new FrameLayout.LayoutParams(-1,-1));
            TextView dot=text("●",10,0xffabaec6);dot.setTag("dot");dot.setGravity(Gravity.CENTER);
            FrameLayout.LayoutParams dotLp=new FrameLayout.LayoutParams(dp(12),dp(12),Gravity.BOTTOM|Gravity.RIGHT);stage.addView(dot,dotLp);
            space(tile,12);TextView name=text(s.optString("ad"),width<=760?12:14,ink);name.setTypeface(font("inter",600));name.setGravity(Gravity.CENTER);tile.addView(name);
            TextView desc=text(s.optString("aciklama"),width<=760?9:10,0xffb1afc5);desc.setGravity(Gravity.CENTER);desc.setMaxLines(2);desc.setPadding(dp(3),dp(5),dp(3),0);tile.addView(desc);
            tile.setContentDescription(s.optString("ad")+(editing?" düzenle":" aç"));tile.setOnClickListener(v->{if(editing)siteActions(s);else launch(s);});tile.setOnLongClickListener(v->{siteActions(s);return true;});
        }
        if(r!=null&&r.getChildCount()>0)((LinearLayout.LayoutParams)r.getChildAt(r.getChildCount()-1).getLayoutParams()).rightMargin=0;
        if(editing)button(shelf,"＋ Site ekle",()->editSite(null));
    }
    private int blend(int c,int d,float r){return Color.rgb((int)(Color.red(c)*(1-r)+Color.red(d)*r),(int)(Color.green(c)*(1-r)+Color.green(d)*r),(int)(Color.blue(c)*(1-r)+Color.blue(d)*r));}
    private void launch(JSONObject s){String path=s.optString("yol").toLowerCase(Locale.ROOT);if(path.contains("keremflix"))navigate(()->FlixScreen.show(this));else if(path.contains("drive"))navigate(()->DriveScreen.show(this));else if(path.contains("kitabevi"))navigate(()->BooksScreen.show(this));else if(path.contains("xxxkerem"))navigate(()->GalleryScreen.show(this));else external(path.startsWith(":")?base()+path:path);}
    private void siteActions(JSONObject s){choose(s.optString("ad"),new String[]{"Aç","Düzenle","Sola taşı","Sağa taşı",s.optBoolean("aktif",true)?"Gizle":"Göster","Kısayolu kaldır"},i->{if(i==0)launch(s);if(i==1)editSite(s);if(i==2||i==3){JSONArray ids=new JSONArray();ArrayList<Integer> list=new ArrayList<>();int index=0;for(int k=0;k<sites.length();k++){int id=sites.optJSONObject(k).optInt("id");list.add(id);if(id==s.optInt("id"))index=k;}int target=index+(i==2?-1:1);if(target>=0&&target<list.size()){Collections.swap(list,index,target);for(int id:list)ids.put(id);request("PUT","/api/siteler/sirala",obj("idler",ids),j->home());}}if(i==4)request("PATCH","/api/siteler/"+s.optInt("id"),obj("aktif",!s.optBoolean("aktif",true)),j->home());if(i==5)confirm("Kısayolu kaldır","Sadece portal kısayolu kaldırılacak. Servis dosyaları korunur.",()->request("DELETE","/api/siteler/"+s.optInt("id"),null,j->home()));});}
    private void editSite(JSONObject s){JSONObject v=s==null?obj("ad","","aciklama","","yol","/","ikon","globe","renk","#2563EB"):s;form("Servis "+(s==null?"ekle":"düzenle"),new String[]{"Ad","Açıklama","Adres","İkon (globe, film, tv, kitap, klasor…)","Renk (#RRGGBB)"},new String[]{v.optString("ad"),v.optString("aciklama"),v.optString("yol"),v.optString("ikon"),v.optString("renk")},values->{if(values[0].trim().isEmpty()){toast("Servis adı gerekli.");return;}request(s==null?"POST":"PATCH","/api/siteler"+(s==null?"":"/"+s.optInt("id")),obj("ad",values[0],"aciklama",values[1],"yol",values[2],"ikon",values[3],"renk",values[4],"aktif",s==null||s.optBoolean("aktif",true)),j->home());});}
    private void system(){theme(0xff141522,0xff262637,0xfff7f7fd,0xffb4b5c9,0xffb2b0f6);LinearLayout p=page("Sistem","Sunucunun canlı durumu");remember(this::system);get("/api/sistem",j->{heading(p,j.optString("model"));metric(p,"İşlemci",j.optString("islemciKullanim","—")+"%",j.optInt("cekirdek")+" çekirdek  •  Yük "+j.optString("yuk"));metric(p,"Sıcaklık",j.optString("sicaklik","—")+" °C","");metric(p,"Bellek",bytes(j.optDouble("bellekToplam")-j.optDouble("bellekBos")),"Toplam "+bytes(j.optDouble("bellekToplam")));metric(p,"Çalışma süresi",String.format(Locale.ROOT,"%.1f saat",j.optDouble("calismaSuresi")/3600),"");JSONArray disks=j.optJSONArray("diskler");if(disks!=null)for(int i=0;i<disks.length();i++){JSONObject d=disks.optJSONObject(i);metric(p,d.optString("ad"),bytes(d.optDouble("toplam")-d.optDouble("bos")),"Toplam "+bytes(d.optDouble("toplam"))+" • Boş "+bytes(d.optDouble("bos")));}button(p,"Yenile",this::system);});}
    private void metric(LinearLayout p,String label,String value,String detail){LinearLayout c=card(p);note(c,label);c.addView(text(value,29,ink));if(!detail.trim().isEmpty())note(c,detail);}
private void settings(){theme(0xff141522,0xff262637,0xfff7f7fd,0xffb4b5c9,0xffb2b0f6);LinearLayout p=page("Ayarlar","Keremhub · Android");remember(this::settings);heading(p,"Bağlantı");note(p,base());button(p,"Sunucu adresini değiştir",()->prompt("Sunucu adresi",base(),v->{try{URI uri=new URI(v);if(!Arrays.asList("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getQuery()!=null||uri.getFragment()!=null||(!uri.getPath().isEmpty()&&!uri.getPath().equals("/")))throw new Exception();prefs.edit().putString("server",v.replaceAll("/+$","")).apply();history.clear();home();}catch(Exception e){toast("Geçerli bir sunucu adresi yaz: http://192.168.1.240");}}));heading(p,"Deneyim");button(p,prefs.getBoolean("motion",true)?"Animasyonlar: Açık":"Animasyonlar: Kapalı",()->{prefs.edit().putBoolean("motion",!prefs.getBoolean("motion",true)).apply();settings();});button(p,"Yerel dosya önbelleğini temizle",()->{api.io.execute(()->{File dir=new File(getCacheDir(),"shared");File[] files=dir.listFiles();if(files!=null)for(File f:files)if(f.isFile())f.delete();api.main.post(()->toast("Dosya önbelleği temizlendi."));});});note(p,"Keremhub 2.0.5\nAndroid’e özel servis ekranları. Kitaplıklar ve ilerleme kayıtları sunucuyla ortak kullanılır.");}

    public void external(String path){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(api.url(path))));}catch(Exception e){toast("Bu bağlantıyı açabilen uygulama yok.");}}
    public void download(String path,String filename,String mime){try{DownloadManager.Request r=new DownloadManager.Request(Uri.parse(api.url(path)));r.setTitle(filename);if(mime!=null)r.setMimeType(mime);r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,filename.replaceAll("[\\\\/:*?\"<>|]","_"));((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(r);toast("İndirme başlatıldı.");}catch(Exception e){toast(e.getMessage());}}
    private File cache(String path,String name)throws Exception{File dir=new File(getCacheDir(),"shared");dir.mkdirs();String safe=name==null?"dosya":name.replaceAll("[\\\\/:*?\"<>|]","_");if(safe.trim().isEmpty()||safe.equals(".")||safe.equals(".."))safe="dosya";File f=new File(dir,safe);java.net.HttpURLConnection c=api.connection(path,"GET");try{if(c.getResponseCode()>=400)throw new IOException("Dosya alınamadı ("+c.getResponseCode()+")");try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(f)){Compat.copy(in,out);}}finally{c.disconnect();}return f;}
    public void share(String path,String mime){fileIntent(path,"keremhub-"+System.currentTimeMillis()+extension(mime),mime,true);}
    private String extension(String mime){String e=android.webkit.MimeTypeMap.getSingleton().getExtensionFromMimeType(mime==null?"":mime);return e==null?"":"."+e;}
    private void fileIntent(String path,String name,String mime,boolean share){toast("Dosya hazırlanıyor…");api.io.execute(()->{try{File f=cache(path,name);api.main.post(()->{if(isDestroyed())return;Uri u=Uri.parse("content://com.keremhub.app.files/"+Uri.encode(f.getName()));Intent in=new Intent(share?Intent.ACTION_SEND:Intent.ACTION_VIEW);if(share){in.setType(mime==null?"*/*":mime);in.putExtra(Intent.EXTRA_STREAM,u);}else in.setDataAndType(u,mime==null?"*/*":mime);in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);in.setClipData(ClipData.newRawUri("Keremhub",u));try{startActivity(Intent.createChooser(in,share?"Paylaş":"Bir uygulamayla aç"));}catch(Exception e){toast("Bu dosya türü için bir uygulama bulunamadı.");}});}catch(Exception e){api.main.post(()->toast(e.getMessage()));}});}
    public void openFile(String path,String name,String mime){if(mime!=null&&mime.startsWith("image/")){photo(path,name);return;}if(mime!=null&&(mime.startsWith("video/")||mime.startsWith("audio/"))){play(path,name,0,null,0,null);return;}if("application/pdf".equals(mime)){navigate(()->ReaderScreen.pdf(this,path,name));return;}if(mime!=null&&(mime.startsWith("text/")||mime.equals("application/json"))){navigate(()->{LinearLayout p=page(name,"Belge önizleme");remember(()->openFile(path,name,mime));int token=generation;api.io.execute(()->{try{HttpURLConnection c=api.connection(path,"GET");String value;try(InputStream in=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n,total=0;while((n=in.read(b))!=-1&&total<1024*1024){out.write(b,0,n);total+=n;}value=out.toString("UTF-8");}finally{c.disconnect();}String txt=value;api.main.post(()->{if(token==generation){TextView t=text(txt,13,ink);t.setTypeface(Typeface.MONOSPACE);t.setTextIsSelectable(true);p.addView(t);}});}catch(Exception e){api.main.post(()->failure(e.getMessage()));}});});return;}fileIntent(path,name,mime,false);}
    public void photo(String path,String title){navigate(()->{LinearLayout p=page(title,"Yakınlaştırmak için iki parmağını kullan");remember(()->photoPage(path,title));photoContent(p,path);});}
    private void photoPage(String path,String title){LinearLayout p=page(title,"Yakınlaştırmak için iki parmağını kullan");remember(()->photoPage(path,title));photoContent(p,path);}
    private void photoContent(LinearLayout p,String path){ZoomImage image=new ZoomImage(this);p.addView(image,new LinearLayout.LayoutParams(-1,dp(470)));api.image(path,image::setImageBitmap);button(p,"İndir",()->download(path,"keremhub-fotoğraf.jpg","image/jpeg"));button(p,"Paylaş",()->share(path,"image/jpeg"));}
    public void readBook(JSONObject book){navigate(()->ReaderScreen.show(this,book));}
    public void play(String stream,String title,double start,String progressPath,int id,Runnable next){play(stream,title,start,progressPath,id,null,next,false);}
    public void play(String stream,String title,double start,String progressPath,int id,Runnable previous,Runnable next,boolean replace){
        // Start Keremflix playback in landscape, even when device rotation is
        // locked. Episode changes retain the viewer's current fullscreen choice.
        boolean wide=replace&&player!=null?player.isFullscreen():stream.contains("/keremflix/");
        Runnable show=()->{PlayerScreen p=new PlayerScreen(this,stream,title,start,progressPath,id,previous,next);p.show();if(wide)p.restoreFullscreen();};
        if(replace)show.run();else navigate(show);
    }
    void setPlayer(PlayerScreen p){player=p;}
    @Override public void onUserLeaveHint(){super.onUserLeaveHint();if(player!=null)player.pip();}
    @Override public void onPictureInPictureModeChanged(boolean active,android.content.res.Configuration config){super.onPictureInPictureModeChanged(active,config);if(player!=null)player.pipModeChanged(active);}
    @Override public void onPause(){super.onPause();if(player!=null)player.pauseForBackground(isInPictureInPictureMode());}
    @Override public void onDestroy(){if(cleanup!=null)cleanup.run();handler.removeCallbacksAndMessages(null);if(api!=null)api.io.shutdown();super.onDestroy();}

    private static class Upload {String path,field,mime;JSONObject fields;Runnable done;Upload(String p,String f,JSONObject fields,String m,Runnable d){path=p;field=f;this.fields=fields;mime=m;done=d;}}
    public void upload(String path,String field,JSONObject fields,String mime,boolean multiple,Runnable done){pendingUpload=new Upload(path,field,fields,mime,done);Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType(mime==null?"*/*":mime);i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,multiple);startActivityForResult(i,41);}
    @Override public void onActivityResult(int req,int result,Intent data){super.onActivityResult(req,result,data);if(req!=41||result!=RESULT_OK||data==null||pendingUpload==null)return;Upload u=pendingUpload;pendingUpload=null;ArrayList<Uri> uris=new ArrayList<>();if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++)uris.add(data.getClipData().getItemAt(i).getUri());}else if(data.getData()!=null)uris.add(data.getData());ProgressDialog progress=new ProgressDialog(this);progress.setTitle("Dosyalar yükleniyor");progress.setMessage("0 / "+uris.size());progress.setCancelable(false);progress.show();int token=generation;api.io.execute(()->{try{String boundary="Keremhub"+UUID.randomUUID();HttpURLConnection c=api.connection(u.path,"POST");c.setReadTimeout(3600000);c.setDoOutput(true);c.setChunkedStreamingMode(64*1024);c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);try(OutputStream out=c.getOutputStream()){Iterator<String> keys=u.fields==null?Collections.emptyIterator():u.fields.keys();while(keys.hasNext()){String k=keys.next();out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+k.replace("\"","")+"\"\r\n\r\n"+u.fields.optString(k)+"\r\n").getBytes("UTF-8"));}int count=0;for(Uri uri:uris){String name="dosya";try(android.database.Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor!=null&&cursor.moveToFirst())name=cursor.getString(0);}String type=getContentResolver().getType(uri);out.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\""+u.field+"\"; filename=\""+name.replaceAll("[\"\r\n]","_")+"\"\r\nContent-Type: "+(type==null?"application/octet-stream":type)+"\r\n\r\n").getBytes("UTF-8"));try(InputStream in=getContentResolver().openInputStream(uri)){Compat.copy(in,out);}out.write("\r\n".getBytes());int done=++count;api.main.post(()->progress.setMessage(done+" / "+uris.size()));}out.write(("--"+boundary+"--\r\n").getBytes());}int status=c.getResponseCode();String response=new String(Api.read(status<400?c.getInputStream():c.getErrorStream()),"UTF-8");c.disconnect();if(status>=400){String message="Yükleme başarısız ("+status+")";try{JSONObject error=new JSONObject(response);message=error.optString("error",message);}catch(Exception ignored){}throw new IOException(message);}api.main.post(()->{progress.dismiss();toast("Yükleme tamamlandı.");if(token==generation&&u.done!=null)u.done.run();});}catch(Exception e){api.main.post(()->{progress.dismiss();failure(e.getMessage());});}});}

    static final class ZoomImage extends ImageView {private float scale=1,dx,dy,lastX,lastY;private final ScaleGestureDetector detector;private final Matrix matrix=new Matrix();ZoomImage(Context c){super(c);setScaleType(ScaleType.MATRIX);detector=new ScaleGestureDetector(c,new ScaleGestureDetector.SimpleOnScaleGestureListener(){public boolean onScale(ScaleGestureDetector d){scale=Math.max(.5f,Math.min(6,scale*d.getScaleFactor()));update();return true;}});}public void setImageBitmap(Bitmap b){super.setImageBitmap(b);post(this::fit);}private void fit(){Drawable d=getDrawable();if(d==null)return;scale=Math.min((float)getWidth()/d.getIntrinsicWidth(),(float)getHeight()/d.getIntrinsicHeight());dx=(getWidth()-d.getIntrinsicWidth()*scale)/2;dy=(getHeight()-d.getIntrinsicHeight()*scale)/2;update();}private void update(){matrix.setScale(scale,scale);matrix.postTranslate(dx,dy);setImageMatrix(matrix);}public boolean onTouchEvent(android.view.MotionEvent e){getParent().requestDisallowInterceptTouchEvent(true);detector.onTouchEvent(e);if(e.getActionMasked()==MotionEvent.ACTION_DOWN){lastX=e.getX();lastY=e.getY();}else if(e.getActionMasked()==MotionEvent.ACTION_MOVE&&!detector.isInProgress()){dx+=e.getX()-lastX;dy+=e.getY()-lastY;lastX=e.getX();lastY=e.getY();update();}return true;}}
}
