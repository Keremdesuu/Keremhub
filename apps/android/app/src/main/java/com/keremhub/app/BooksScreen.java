package com.keremhub.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Fragment;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.ColorFilter;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.MultiAutoCompleteTextView;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

/** Native book archive. The management API consumes FormData, never JSON. */
public final class BooksScreen {
    private static final String ROOT = "/keremkitabevi";
    private static final String MANAGE = ROOT + "/api/mobile/manage";
    private static final String[] STATUS = {"want", "reading", "read", "dropped"};
    private static final String[] STATUS_LABEL = {"Okumak istiyorum", "Okunuyor", "Okundu", "Yarım bırakıldı"};
    private static final Locale TR = Locale.forLanguageTag("tr-TR");
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final int BG = 0xff0c1022;
    private static final int SURFACE = 0xff141a33;
    private static final int FG = 0xffe9ecfa;
    private static final int MUTED = 0xff8e97c2;
    private static final int SIGNAL = 0xff7a8cff;
    private static final int LINE = 0xff28305a;

    private final MainActivity a;
    private LinearLayout body;
    private Runnable reloadPage;
    private boolean writing;
    private JSONArray catalog;
    private int activeTab;
    private int widthDp() { return a.getResources().getConfiguration().screenWidthDp; }

    private BooksScreen(MainActivity activity) { a = activity; }
    public static void show(MainActivity a) { new BooksScreen(a).home(); }

    private static String str(JSONObject o, String key) {
        return o == null || o.isNull(key) ? "" : o.optString(key, "");
    }
    private static JSONArray array(JSONObject o, String key) {
        JSONArray value = o == null ? null : o.optJSONArray(key);
        return value == null ? new JSONArray() : value;
    }
    private static JSONObject object(JSONObject o, String key) {
        JSONObject value = o == null ? null : o.optJSONObject(key);
        return value == null ? new JSONObject() : value;
    }
    private static String name(JSONObject book, String relation) { return str(object(book, relation), "name"); }
    private static boolean has(JSONArray values, int id) {
        for (int i = 0; i < values.length(); i++) if (values.optInt(i) == id) return true;
        return false;
    }
    private static String statusLabel(String value) {
        for (int i = 0; i < STATUS.length; i++) if (STATUS[i].equals(value)) return STATUS_LABEL[i];
        return "Takip edilmiyor";
    }
    private static String date(String value) { return value.length() >= 10 ? value.substring(0, 10) : value; }
    private static String mime(JSONObject book) { return "pdf".equals(str(book, "format")) ? "application/pdf" : "application/epub+zip"; }
    private static String filename(JSONObject book) {
        String ext = "kepub".equals(str(book, "format")) ? "kepub.epub" : str(book, "format");
        return str(book, "title").replaceAll("[\\\\/:*?\"<>|]", " ") + "." + ext;
    }

    private LinearLayout page(String title, String subtitle, int tab, Runnable reload) {
        activeTab=tab;
        a.theme(BG, SURFACE, FG, MUTED, SIGNAL);
        body = a.page(title, subtitle);
        final int pageGeneration=a.generation;
        body.addOnLayoutChangeListener((view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->{
            if(oldRight>oldLeft&&Math.abs((right-left)-(oldRight-oldLeft))>a.dp(32))view.post(()->{if(a.generation==pageGeneration)reload.run();});
        });
        reloadPage=reload;
        a.remember(reload);
        a.root.getChildAt(0).setVisibility(View.GONE);
        int inset=widthDp()>=640?24:16;
        body.setPadding(a.dp(inset), a.dp(tab==1?32:0), a.dp(inset), a.dp(36));
        LinearLayout header = a.row();
        header.setPadding(a.dp(16), a.dp(10), a.dp(16), a.dp(10));
        header.setBackgroundColor(BG);
        header.setMinimumHeight(a.dp(62));
        String[] icons = {"logo", "home", "library", "kobo", "bookmark", "search", "grid"};
        String[] labels = {"Kerem Kitabevi", "Ana sayfa", "Kütüphane", "Kobo", "Takip", "Kitap ara", "Keremhub"};
        Runnable[] actions = {() -> a.navigate(this::home), () -> a.navigate(this::home),
                () -> a.navigate(() -> library(new Filter(), 1)), () -> a.navigate(() -> kobo(1)), () -> a.navigate(() -> tracking("", 0, 1)),
                this::searchBooks, () -> a.navigate(a::home)};
        for (int i=0;i<icons.length;i++) {
            final int index=i;
            int selected=tab==0?1:tab==1?2:tab==2?4:tab==3?3:-1;
            View icon = icon(icons[i], i==selected?FG:MUTED);
            if(i==selected)icon.setBackground(a.shape(SURFACE,8));
            icon.setContentDescription(labels[i]);
            icon.setOnClickListener(v -> actions[index].run());
            if(i==0){icon.setContentDescription("Kerem Kitabevi; basılı tut: yenile");icon.setOnLongClickListener(v->{reload.run();return true;});}
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(i==0?a.dp(34):0,a.dp(40),i==0?0:1);
            if(i==0)lp.setMargins(0,0,a.dp(16),0);
            if(i==5||i==6) {
                icon.setBackground(outline(i==5?SURFACE:BG,8));
                lp.setMargins(a.dp(8),0,0,0);
            }
            header.addView(icon,lp);
        }
        LinearLayout fixed=a.column();fixed.addView(header,new LinearLayout.LayoutParams(-1,-2));
        View rule=new View(a);rule.setBackgroundColor(LINE);fixed.addView(rule,new LinearLayout.LayoutParams(-1,a.dp(1)));
        a.root.addView(fixed,0);
        if(tab!=0&&tab!=1){a.space(body,20);title(body,title);if(subtitle!=null&&!subtitle.isEmpty())note(body,subtitle);}
        return body;
    }
    private void searchBooks() {
        prompt("Kitap, yazar veya seri ara", "", q->{Filter f=new Filter();f.q=q;a.navigate(()->library(f,1));});
    }
    private TextView text(String value,int size,int color) {
        TextView t=a.text(value,size,color);t.setTypeface(a.font("bricolage",400));
        t.setIncludeFontPadding(false);t.setLineSpacing(0,1f);return t;
    }
    private GradientDrawable outline(int color,int radius) {
        GradientDrawable d=a.shape(color,radius);d.setStroke(a.dp(1),LINE);return d;
    }
    private TextView title(LinearLayout parent, String text) {
        TextView t = text(text, 25, FG);
        t.setTypeface(a.font("bricolage",700));
        t.setPadding(0, a.dp(14), 0, a.dp(9));
        parent.addView(t);
        return t;
    }
    private void note(LinearLayout parent, String text) {
        TextView t = text(text, 14, MUTED);
        t.setLineSpacing(a.dp(3), 1f);
        t.setPadding(0, a.dp(5), 0, a.dp(8));
        parent.addView(t);
    }
    private TextView button(LinearLayout parent, String label, Runnable click) {
        TextView t = a.button(parent, label, click);
        t.setBackground(new android.graphics.drawable.RippleDrawable(
                android.content.res.ColorStateList.valueOf(0x258088ff), outline(BG,8), null));
        t.setTextColor(FG);
        t.setMinHeight(a.dp(40));
        t.setPadding(a.dp(14),a.dp(10),a.dp(14),a.dp(10));
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setTypeface(a.font("bricolage",500));
        return t;
    }
    private View action(LinearLayout parent,String symbol,String label,boolean primary,Runnable click) {
        LinearLayout row=a.row();row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(a.dp(16),a.dp(10),a.dp(16),a.dp(10));
        row.setBackground(new android.graphics.drawable.RippleDrawable(android.content.res.ColorStateList.valueOf(0x258088ff),primary?a.shape(SIGNAL,8):outline(BG,8),null));
        View mark=icon(symbol,primary?BG:FG);row.addView(mark,new LinearLayout.LayoutParams(a.dp(18),a.dp(18)));
        TextView t=text(label,14,primary?BG:FG);t.setTypeface(a.font("bricolage",primary?600:500));
        LinearLayout.LayoutParams textLp=new LinearLayout.LayoutParams(-2,-2);textLp.leftMargin=a.dp(8);row.addView(t,textLp);
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);lp.bottomMargin=a.dp(12);if(parent.getOrientation()==LinearLayout.HORIZONTAL)lp.rightMargin=a.dp(12);parent.addView(row,lp);
        row.setMinimumHeight(a.dp(38));row.setContentDescription(label);row.setOnClickListener(v->click.run());return row;
    }
    private void coverImage(LinearLayout parent,String path,int height,Runnable click) {
        a.image(parent,path,height,click);
        View image=parent.getChildAt(parent.getChildCount()-1);
        if(image instanceof ImageView){((ImageView)image).setScaleType(ImageView.ScaleType.FIT_CENTER);image.setBackground(outline(SURFACE,8));}
    }
    private TextView loading(LinearLayout parent) {
        TextView t = text("Kitaplık yükleniyor…", 15, MUTED);
        parent.addView(t);
        return t;
    }
    private AlertDialog.Builder dialog() { return new AlertDialog.Builder(a,android.R.style.Theme_Material_Dialog_Alert); }
    private void choose(String heading,String[] options,IntConsumer selected) {
        dialog().setTitle(heading).setItems(options,(d,n)->selected.accept(n)).setNegativeButton("Vazgeç",null).show();
    }
    private void confirm(String heading,String message,Runnable yes) {
        dialog().setTitle(heading).setMessage(message).setNegativeButton("Vazgeç",null).setPositiveButton("Onayla",(d,n)->yes.run()).show();
    }
    private void prompt(String heading,String initial,Consumer<String> answer) {
        EditText input=new EditText(new android.view.ContextThemeWrapper(a,android.R.style.Theme_Material));
        input.setText(initial);input.setTextColor(FG);input.setTypeface(a.font("bricolage",400));input.setSingleLine(true);input.setSelectAllOnFocus(true);
        LinearLayout wrap=a.column();wrap.setPadding(a.dp(22),a.dp(8),a.dp(22),a.dp(8));wrap.addView(input);
        dialog().setTitle(heading).setView(wrap).setNegativeButton("Vazgeç",null).setPositiveButton("Kaydet",(d,n)->answer.accept(input.getText().toString().trim())).show();
    }

    private void home() {
        LinearLayout p = page("Kerem Kitabevi", "", 0, this::home);
        p.setBackground(new GridPaper());
        a.space(p,widthDp()>=640?80:56);
        TextView hero=text("Kerem\nKitabevi",Math.max(48,Math.min(112,Math.round(widthDp()*.09f))),FG);
        hero.setTypeface(a.font("bricolage",800));hero.setLetterSpacing(-.045f);
        hero.setLineSpacing(0,.92f);p.addView(hero);
        a.space(p,28);
        TextView intro=text("Rafındaki tüm e-kitaplar tek yerde. Yazara, seriye ve türe göre bul; tarayıcıda oku ya da indir.",18,0xffb7b8e6);
        intro.setTypeface(a.font("serif",400));intro.setLineSpacing(0,1.625f);p.addView(intro);
        a.space(p,34);
        LinearLayout heroActions=widthDp()>=640?a.row():a.column();p.addView(heroActions);
        action(heroActions,"library","Kütüphaneye gir",true,()->a.navigate(()->library(new Filter(),1)));
        action(heroActions,"scan","Kütüphaneyi tara",false,this::scan);
        action(heroActions,"upload","Kitap yükle",false,this::uploadBook);
        a.space(p,28);
        LinearLayout stats=a.row();p.addView(stats,new LinearLayout.LayoutParams(-1,-2));
        TextView[] counts=new TextView[3];String[] labels={"kitap","yazar","seri"};
        for(int i=0;i<3;i++){
            LinearLayout pair=a.row();pair.setGravity(Gravity.BOTTOM);
            counts[i]=text("—",24,FG);counts[i].setTypeface(a.font("bricolage",700));pair.addView(counts[i]);
            TextView label=text(labels[i],13,MUTED);label.setPadding(a.dp(7),0,0,a.dp(2));pair.addView(label);
            stats.addView(pair,new LinearLayout.LayoutParams(0,-2,1));
        }
        a.space(p,48);
        LinearLayout shelf=a.column();p.addView(shelf,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout content=a.column();p.addView(content);
        TextView wait=loading(content);
        a.get(ROOT + "/api/mobile/home", data -> {
            content.removeView(wait);
            counts[0].setText(String.valueOf(data.optInt("total")));counts[1].setText(String.valueOf(data.optInt("authors")));counts[2].setText(String.valueOf(data.optInt("series")));
            spines(shelf,array(data,"spines"));
            if(array(data,"reading").length()>0)section(content,"Okumaya devam et",array(data,"reading"),"");
            if(array(data,"latest").length()>0){a.space(content,24);section(content,"Son eklenenler",array(data,"latest"),"");}
            if(data.optInt("total")==0)note(content,"Raf boş. Kitap yükle veya kütüphaneyi tara.");
            button(content,"Tümünü gör",()->a.navigate(()->library(new Filter(),1)));
            button(content,"Kobo cihazını bağla",()->a.navigate(()->kobo(1)));
        });
    }
    private void section(LinearLayout p, String heading, JSONArray books, String empty) {
        title(p, heading);
        if (books.length() == 0) note(p, empty);
        else bookRows(p, books, false);
    }
    private void spines(LinearLayout parent,JSONArray books) {
        parent.setBackground(outline(0xb3141a33,12));
        parent.setPadding(a.dp(16),a.dp(32),a.dp(16),0);
        HorizontalScrollView sc=new HorizontalScrollView(a);sc.setHorizontalScrollBarEnabled(false);
        LinearLayout shelf=a.row();shelf.setGravity(Gravity.BOTTOM);
        for(int i=0;i<books.length();i++){
            JSONObject book=books.optJSONObject(i);if(book==null)continue;
            int id=book.optInt("id");long hash=(id*2654435761L)&0xffffffffL;
            int width=22+(int)(hash%5)*5;
            int height=150+(int)((hash>>>8)%6)*14+(int)Math.min(30,Math.floor(book.optDouble("sizeBytes")/2000000)*4);
            int hue=book.optInt("coverHue",235);
            View spine=new View(a){
                final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
                @Override protected void onDraw(Canvas canvas){
                    super.onDraw(canvas);canvas.save();canvas.clipRect(0,0,getWidth(),getHeight());
                    canvas.translate(getWidth()/2f,getHeight()/2f);canvas.rotate(90);
                    paint.setColor(0xd9ffffff);paint.setTextSize(a.dp(11));paint.setTypeface(a.font("bricolage",500));
                    String label=str(book,"title");if(label.length()>34)label=label.substring(0,33)+"…";
                    canvas.drawText(label,-getHeight()/2f+a.dp(11),-((paint.ascent()+paint.descent())/2),paint);canvas.restore();
                }
            };
            GradientDrawable background=new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{hsl(hue,.50f,.34f),hsl(hue,.46f,.24f)});
            background.setCornerRadii(new float[]{a.dp(3),a.dp(3),a.dp(3),a.dp(3),0,0,0,0});background.setStroke(a.dp(1),hsl(hue,.55f,.40f));spine.setBackground(background);
            spine.setContentDescription(str(book,"title"));spine.setOnClickListener(v->openBook(id));
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(a.dp(width),a.dp(height));lp.rightMargin=a.dp(4);shelf.addView(spine,lp);
        }
        if(books.length()==0){TextView empty=text("Rafın yeni hikâyelerini bekliyor.",14,MUTED);empty.setGravity(Gravity.CENTER);shelf.addView(empty,new LinearLayout.LayoutParams(a.dp(270),a.dp(190)));}
        sc.addView(shelf);parent.addView(sc,new LinearLayout.LayoutParams(-1,-2));
        View ledge=new View(a);ledge.setBackground(outline(0xff1b2243,2));parent.addView(ledge,new LinearLayout.LayoutParams(-1,a.dp(6)));
    }
    private static int hsl(float hue,float saturation,float lightness) {
        float value=lightness+saturation*Math.min(lightness,1-lightness);
        return Color.HSVToColor(new float[]{hue,value==0?0:2*(1-lightness/value),value});
    }
    /** Native line icons keep toolbar actions independent of fonts and emoji rendering. */
    private View icon(String name,int color) {
        return new View(a){
            final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
            private void line(Canvas c,float... points){Path p=new Path();p.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)p.lineTo(points[i],points[i+1]);c.drawPath(p,paint);}
            @Override protected void onDraw(Canvas c){
                super.onDraw(c);float size=Math.min(Math.min(getWidth(),getHeight()),a.dp("logo".equals(name)?34:18));c.save();c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24,size/24);
                paint.setColor(color);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.7f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);
                switch(name){
                    case "logo":
                        paint.setColor(SURFACE);paint.setStyle(Paint.Style.FILL);c.drawRoundRect(.5f,.5f,23.5f,23.5f,6,6,paint);paint.setStyle(Paint.Style.STROKE);paint.setColor(LINE);c.drawRoundRect(.5f,.5f,23.5f,23.5f,6,6,paint);
                        paint.setStyle(Paint.Style.FILL);paint.setColor(SIGNAL);c.drawRoundRect(5,5,8,19,1,1,paint);paint.setColor(0xffa4acff);c.drawRoundRect(9.5f,7,12.5f,19,1,1,paint);c.save();c.rotate(13,16,13);paint.setColor(0xffffb547);c.drawRoundRect(14,6,17.5f,19,1,1,paint);c.restore();c.drawCircle(19,5,1,paint);break;
                    case "home":line(c,3,10,12,3,21,10);line(c,5,9,5,21,10,21,10,14,14,14,14,21,19,21,19,9);break;
                    case "library":c.drawRoundRect(3,3,7,21,1,1,paint);c.drawRoundRect(9,6,13,21,1,1,paint);line(c,15,6,19,5,23,20,19,21,15,6);break;
                    case "bookmark":line(c,5,3,19,3,19,21,12,17,5,21,5,3);line(c,9,9,11,11,15,7);break;
                    case "search":c.drawCircle(10,10,7,paint);line(c,15,15,21,21);break;
                    case "grid":for(int x=3;x<=13;x+=10)for(int y=3;y<=13;y+=10)c.drawRoundRect(x,y,x+7,y+7,1.5f,1.5f,paint);break;
                    case "upload":line(c,12,16,12,2);line(c,6,8,12,2,18,8);line(c,3,14,3,21,21,21,21,14);break;
                    case "scan":line(c,3,7,3,3,8,3);line(c,16,3,21,3,21,7);line(c,21,17,21,21,16,21);line(c,8,21,3,21,3,17);line(c,6,12,18,12);break;
                    case "filter":line(c,3,5,21,5);line(c,6,12,18,12);line(c,10,19,14,19);break;
                    case "kobo":c.drawRoundRect(5,2,19,22,2,2,paint);line(c,9,7,15,7);line(c,9,11,15,11);line(c,9,15,15,15);c.drawCircle(12,19,.5f,paint);break;
                }c.restore();
            }
        };
    }
    private final class GridPaper extends Drawable {
        final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas canvas){
            canvas.drawColor(BG);paint.setStrokeWidth(a.dp(1));int step=a.dp(48),height=Math.min(getBounds().height(),a.dp(950));
            for(int y=0;y<=height;y+=step){int alpha=Math.round(18*Math.max(0,1-y/(float)height));paint.setColor((alpha<<24)|0x7a8cff);canvas.drawLine(0,y,getBounds().width(),y,paint);}
            paint.setShader(new android.graphics.LinearGradient(0,0,0,height,new int[]{0x127a8cff,0x0c7a8cff,0x007a8cff},null,android.graphics.Shader.TileMode.CLAMP));
            for(int x=step;x<getBounds().width();x+=step)canvas.drawLine(x,0,x,height,paint);paint.setShader(null);
        }
        @Override public void setAlpha(int alpha){}
        @Override public void setColorFilter(ColorFilter filter){}
        @Override public int getOpacity(){return PixelFormat.OPAQUE;}
    }
    /** The web BookCard: a 2:3 cover, overlay badges, then bare title and author. */
    private void bookRows(LinearLayout parent, JSONArray books, boolean koboActions) {
        LinearLayout row=null;
        int visible=0;
        int columns=activeTab==0?(widthDp()>=1024?6:widthDp()>=768?4:widthDp()>=640?3:2)
                :widthDp()>=1536?5:widthDp()>=1280?4:widthDp()>=640?3:2;
        int coverHeight=Math.round((widthDp()-(widthDp()>=640?48:32)-20*(columns-1))/(float)columns*1.5f);
        for(int i=0;i<books.length();i++){
            JSONObject b=books.optJSONObject(i);if(b==null)continue;
            if(visible%columns==0){row=a.row();row.setGravity(Gravity.TOP);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.bottomMargin=a.dp(32);parent.addView(row,rp);}
            int id=b.optInt("id");
            LinearLayout tile=a.column();LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,-2,1);
            if(visible%columns>0)tp.leftMargin=a.dp(20);
            row.addView(tile,tp);visible++;
            FrameLayout cover=new FrameLayout(a){
                @Override protected void onMeasure(int widthSpec,int heightSpec){int width=View.MeasureSpec.getSize(widthSpec);super.onMeasure(widthSpec,View.MeasureSpec.makeMeasureSpec(Math.round(width*1.5f),View.MeasureSpec.EXACTLY));}
            };
            cover.setBackground(outline(SURFACE,8));cover.setClipToOutline(true);
            tile.addView(cover,new LinearLayout.LayoutParams(-1,a.dp(coverHeight)));
            if(b.optBoolean("hasCover")){
                LinearLayout layer=a.column();cover.addView(layer,new FrameLayout.LayoutParams(-1,-1));
                a.image(layer,ROOT+"/api/books/"+id+"/cover?v="+a.enc(str(b,"updatedAt")),coverHeight,()->openBook(id));
                ImageView image=(ImageView)layer.getChildAt(0);image.setScaleType(ImageView.ScaleType.CENTER_CROP);
                image.setBackgroundColor(SURFACE);image.setLayoutParams(new LinearLayout.LayoutParams(-1,-1));
            }else{
                TextView fallback=text(str(b,"title"),20,FG);fallback.setTypeface(a.font("bricolage",700));fallback.setGravity(Gravity.CENTER);fallback.setPadding(a.dp(12),a.dp(24),a.dp(12),a.dp(24));
                int hue=b.optInt("coverHue",235);int color=Color.HSVToColor(new float[]{hue,.46f,.32f});fallback.setBackgroundColor(color);cover.addView(fallback,new FrameLayout.LayoutParams(-1,-1));
            }
            // A foreground border stays visible over full-bleed cover artwork.
            cover.setForeground(outline(Color.TRANSPARENT,8));
            TextView format=text(str(b,"format").toUpperCase(TR),11,0xffb7c0ff);format.setPadding(a.dp(6),a.dp(3),a.dp(6),a.dp(3));format.setBackground(a.shape(0xe60d1023,4));
            FrameLayout.LayoutParams badge=new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.RIGHT);badge.setMargins(a.dp(8),a.dp(8),a.dp(8),0);cover.addView(format,badge);
            if(b.optBoolean("koboSync")){
                boolean sent=!str(object(b,"koboState"),"downloadedAt").isEmpty();
                int koboColor=sent?0xffa7f3d0:0xfff4d778;
                LinearLayout kobo=a.row();kobo.setPadding(a.dp(6),a.dp(4),a.dp(6),a.dp(4));
                kobo.addView(icon("kobo",koboColor),new LinearLayout.LayoutParams(a.dp(14),a.dp(14)));
                TextView koboLabel=text("Kobo",11,koboColor);koboLabel.setTypeface(a.font("bricolage",600));koboLabel.setPadding(a.dp(4),0,0,0);kobo.addView(koboLabel);
                GradientDrawable kd=a.shape(0xf20d1023,4);kd.setStroke(a.dp(1),sent?0x6652bd9a:0x668d793b);kobo.setBackground(kd);
                kobo.setContentDescription(sent?"Kobo’ya aktarıldı; son aktarım durumu":"Kobo gönderimi bekliyor");
                FrameLayout.LayoutParams kl=new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.LEFT);kl.setMargins(a.dp(8),a.dp(8),0,0);cover.addView(kobo,kl);
            }
            int percent=(int)Math.round(object(b,"progress").optDouble("percent",0)*100);
            if(percent>0){
                ProgressBar progress=new ProgressBar(a,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);progress.setProgress(Math.min(100,percent));progress.setProgressTintList(android.content.res.ColorStateList.valueOf(0xffffb547));
                cover.addView(progress,new FrameLayout.LayoutParams(-1,a.dp(4),Gravity.BOTTOM));
            }
            TextView t=text(str(b,"title"),14,FG);t.setTypeface(a.font("bricolage",500));t.setMaxLines(2);t.setEllipsize(android.text.TextUtils.TruncateAt.END);t.setLineSpacing(a.dp(2),1f);t.setPadding(0,a.dp(11),0,0);tile.addView(t);
            TextView author=text(name(b,"author").isEmpty()?"Yazar bilinmiyor":name(b,"author"),12,MUTED);author.setSingleLine(true);author.setEllipsize(android.text.TextUtils.TruncateAt.END);author.setPadding(0,a.dp(5),0,0);tile.addView(author);
            tile.setContentDescription(str(b,"title")+", "+name(b,"author")+", ayrıntıları aç");tile.setOnClickListener(v->openBook(id));cover.setOnClickListener(v->openBook(id));
            if(koboActions){
                String downloaded=str(object(b,"koboState"),"downloadedAt");note(tile,downloaded.isEmpty()?"Gönderim bekliyor":"Dosya aktarıldı · "+date(downloaded));
                button(tile,"Yeniden gönder",()->mutate(a.obj("action","kobo","id",id,"on","true","returnTo","kobo"),r->kobo(1)));
                button(tile,"Listeden çıkar",()->mutate(a.obj("action","kobo","id",id,"on","false","returnTo","kobo"),r->kobo(1)));
            }
        }
        while(visible%columns!=0){View empty=new View(a);LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(0,1,1);ep.leftMargin=a.dp(20);row.addView(empty,ep);visible++;}
    }
    private void openBook(int id) { a.navigate(() -> detail(id)); }

    private static final class Filter {
        String q = "", format = "", authorName = "", seriesName = "", genreName = "";
        int author, series, genre, sort, size = 25;
        Filter copy() {
            Filter f = new Filter(); f.q=q; f.format=format; f.author=author; f.series=series; f.genre=genre;
            f.authorName=authorName; f.seriesName=seriesName; f.genreName=genreName; f.sort=sort; f.size=size; return f;
        }
    }
    private String libraryPath(Filter f, int page) {
        return ROOT + "/api/mobile/library?page=" + page + "&q=" + a.enc(f.q) + "&format=" + a.enc(f.format)
                + (f.author > 0 ? "&authorId=" + f.author : "") + (f.series > 0 ? "&seriesId=" + f.series : "")
                + (f.genre > 0 ? "&genreId=" + f.genre : "");
    }
    private void library(Filter input, int requestedPage) {
        Filter f = input.copy();
        LinearLayout p = page("Kütüphane", "", 1, () -> library(f, requestedPage));
        LinearLayout filters=a.column();
        View toggle=action(p,"filter","Filtreler",false,()->filters.setVisibility(filters.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE));
        LinearLayout.LayoutParams toggleLp=(LinearLayout.LayoutParams)toggle.getLayoutParams();toggleLp.width=-1;toggleLp.bottomMargin=0;toggle.setLayoutParams(toggleLp);
        toggle.setContentDescription("Filtreleri aç veya kapat");
        filters.setPadding(a.dp(12),a.dp(12),a.dp(12),a.dp(12));filters.setBackground(outline(SURFACE,8));filters.setVisibility(View.GONE);p.addView(filters);
        a.search(filters,"Kitap, yazar veya seri ara",q->{Filter next=f.copy();next.q=q.trim();library(next,1);});
        segments(filters,"",new String[]{"Tümü","EPUB","KEPUB","PDF"},f.format.isEmpty()?0:"epub".equals(f.format)?1:"kepub".equals(f.format)?2:3,n->{Filter next=f.copy();next.format=new String[]{"","epub","kepub","pdf"}[n];library(next,1);});
        button(filters,"Yazar: "+(f.author==0?"Tümü":f.authorName),()->selectFacet(f,"author"));
        button(filters,"Seri: "+(f.series==0?"Tümü":f.seriesName),()->selectFacet(f,"series"));
        button(filters,"Tür: "+(f.genre==0?"Tümü":f.genreName),()->selectFacet(f,"genre"));
        button(filters,"Kütüphaneyi tara",this::scan);
        boolean active=!f.q.isEmpty()||!f.format.isEmpty()||f.author>0||f.series>0||f.genre>0;
        if(active||f.sort!=0||f.size!=25)button(filters,"Arama ve filtreleri temizle",()->library(new Filter(),1));
        a.space(p,32);
        List<String> names=new ArrayList<>();if(!f.q.isEmpty())names.add("“"+f.q+"”");if(f.author>0)names.add(f.authorName);if(f.series>0)names.add(f.seriesName);if(f.genre>0)names.add(f.genreName);
        TextView heading=text(names.isEmpty()?"Tüm kitaplar":String.join(" · ",names),28,FG);heading.setTypeface(a.font("bricolage",700));heading.setLetterSpacing(-.025f);p.addView(heading);
        TextView count=text("Kitaplar yükleniyor…",14,MUTED);count.setPadding(0,a.dp(8),0,0);p.addView(count);
        a.space(p,20);
        action(p,"upload","Kitap yükle",false,this::uploadBook);
        segments(p,"Kitap/sayfa",new String[]{"25","50","75","100"},f.size/25-1,n->{Filter next=f.copy();next.size=(n+1)*25;library(next,1);});
        segments(p,"",new String[]{"Yeni eklenen","Başlık","Yazar"},f.sort,n->{Filter next=f.copy();next.sort=n;library(next,1);});
        a.space(p,12);
        LinearLayout results = a.column(); p.addView(results);
        TextView wait=loading(results);
        // The endpoint is paginated and may ignore sort/page size. Collect the
        // complete result first so every book remains reachable.
        fetchAll(f, 1, new JSONArray(), wait, books -> {
                List<JSONObject> sorted=new ArrayList<>();
                for(int i=0;i<books.length();i++) if(books.optJSONObject(i)!=null) sorted.add(books.optJSONObject(i));
                Collator tr=Collator.getInstance(TR); tr.setStrength(Collator.PRIMARY);
                Comparator<JSONObject> titleOrder=(x,y)->naturalCompare(tr,str(x,"title"),str(y,"title"));
                if(f.series>0) sorted.sort(Comparator.comparingDouble((JSONObject b)->b.optDouble("seriesIndex",Double.MAX_VALUE)).thenComparing(titleOrder));
                else if(f.sort==1) sorted.sort(titleOrder);
                else if(f.sort==2) sorted.sort((x,y)->{String xa=name(x,"author"),ya=name(y,"author"); int c=xa.isEmpty()?(ya.isEmpty()?0:1):ya.isEmpty()?-1:naturalCompare(tr,xa,ya);return c==0?titleOrder.compare(x,y):c;});
                int pages=Math.max(1,(sorted.size()+f.size-1)/f.size), page=Math.max(1,Math.min(requestedPage,pages));
                JSONArray slice=new JSONArray();
                for(int i=(page-1)*f.size;i<Math.min(page*f.size,sorted.size());i++) slice.put(sorted.get(i));
                results.removeView(wait);count.setText(sorted.size()+" kitap");renderLibrary(results,f,slice,sorted.size(),page,pages);
            });

    }
    private static int naturalCompare(Collator collator,String left,String right) {
        int i=0,j=0;
        while(i<left.length()&&j<right.length()) {
            boolean digits=Character.isDigit(left.charAt(i))&&Character.isDigit(right.charAt(j));
            int x=i+1,y=j+1;
            while(x<left.length()&&Character.isDigit(left.charAt(x))==digits)x++;
            while(y<right.length()&&Character.isDigit(right.charAt(y))==digits)y++;
            String a=left.substring(i,x),b=right.substring(j,y);int c;
            if(digits){String an=a.replaceFirst("^0+(?!$)",""),bn=b.replaceFirst("^0+(?!$)","");c=Integer.compare(an.length(),bn.length());if(c==0)c=an.compareTo(bn);}
            else c=collator.compare(a,b);
            if(c!=0)return c;i=x;j=y;
        }
        return Integer.compare(left.length()-i,right.length()-j);
    }
    private void segments(LinearLayout p,String caption,String[] labels,int selected,IntConsumer change) {
        HorizontalScrollView sc=new HorizontalScrollView(a);sc.setHorizontalScrollBarEnabled(false);
        LinearLayout group=a.row();group.setPadding(a.dp(4),a.dp(4),a.dp(4),a.dp(4));group.setBackground(outline(BG,8));
        if(!caption.isEmpty()){TextView label=text(caption,12,MUTED);label.setPadding(a.dp(8),0,a.dp(8),0);group.addView(label);}
        for(int i=0;i<labels.length;i++){
            final int index=i;TextView t=text(labels[i],14,i==selected?BG:MUTED);t.setGravity(Gravity.CENTER);t.setPadding(a.dp(caption.isEmpty()?12:10),a.dp(7),a.dp(caption.isEmpty()?12:10),a.dp(7));t.setMinHeight(a.dp(32));t.setBackground(a.shape(i==selected?SIGNAL:Color.TRANSPARENT,6));
            t.setSelected(i==selected);t.setContentDescription((caption.isEmpty()?"Sıralama":caption)+": "+labels[i]);t.setOnClickListener(v->change.accept(index));
            LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);if(i>0)lp.leftMargin=a.dp(4);group.addView(t,lp);
        }
        sc.addView(group,new HorizontalScrollView.LayoutParams(-2,-2));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=a.dp(12);p.addView(sc,lp);
    }
    private void renderLibrary(LinearLayout p,Filter f,JSONArray books,int total,int page,int pages) {

        if(books.length()==0) note(p,"Bu arama ve filtrelerle kitap bulunamadı."); else bookRows(p,books,false);
        pagination(p,page,pages,n->library(f,n));
    }
    private void pagination(LinearLayout p,int page,int pages,Consumer<Integer> go) {
        if(pages<=1)return;
        a.space(p,24);LinearLayout nav=a.row();nav.setGravity(Gravity.CENTER);p.addView(nav);
        if(page>1)button(nav,"Önceki",()->go.accept(page-1));
        TextView label=text(page+" / "+pages,14,MUTED);label.setPadding(a.dp(12),0,a.dp(12),0);nav.addView(label);
        if(page<pages)button(nav,"Sonraki",()->go.accept(page+1));
        if(pages>2)button(p,"Sayfaya git",()->prompt("Sayfa (1–"+pages+")",String.valueOf(page),value->{try{int n=Integer.parseInt(value.trim());if(n<1||n>pages)throw new NumberFormatException();go.accept(n);}catch(NumberFormatException e){a.toast("Geçerli bir sayfa girin.");}}));
    }
    private void fetchAll(Filter f,int page,JSONArray acc,TextView progress,Consumer<JSONArray> done) {
        final int generation=a.generation;
        a.get(libraryPath(f,page),data->{
            if(generation!=a.generation)return;
            java.util.HashSet<Long> ids=new java.util.HashSet<>();for(int i=0;i<acc.length();i++)ids.add(acc.optJSONObject(i).optLong("id"));
            JSONArray items=array(data,"books");int added=0;
            for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item!=null&&ids.add(item.optLong("id"))){acc.put(item);added++;}}
            int current=data.optInt("page",page),pages=data.optInt("pages",1);
            progress.setText("Kitaplar yükleniyor · "+acc.length()+" / "+data.optInt("total",acc.length()));
            if(current<pages&&(current!=page||added==0)){
                progress.setText("Kütüphane tamamlanamadı: sunucu aynı veya boş sayfayı döndürdü. Yenilemek için Kitabevi simgesine basılı tutun.");return;
            }
            if(current<pages)fetchAll(f,page+1,acc,progress,done);else if(data.optInt("total",acc.length())>acc.length()){
                progress.setText("Kütüphane değişti veya eksik sonuç döndü. Tam liste için yeniden yükleyin.");
            }else done.accept(acc);
        });
    }
    private void selectFacet(Filter f,String relation) {
        if(catalog!=null){facetDialog(f,relation);return;}
        LinearLayout p=body;
        TextView wait=loading(p);wait.setText("Filtre seçenekleri kitaplıktan yükleniyor…");
        fetchAll(new Filter(),1,new JSONArray(),wait,books->{p.removeView(wait);catalog=books;facetDialog(f,relation);});
    }
    private void facetDialog(Filter f,String relation) {
        Map<Integer,String> facets=new LinkedHashMap<>();facets.put(0,"Tümü");
        for(int i=0;i<catalog.length();i++){
            JSONObject b=catalog.optJSONObject(i);if(b==null)continue;
            if("genre".equals(relation)){
                JSONArray genres=array(b,"genres");for(int j=0;j<genres.length();j++){JSONObject g=genres.optJSONObject(j);if(g!=null)facets.put(g.optInt("id"),str(g,"name"));}
            }else{JSONObject item=b.optJSONObject(relation);if(item!=null)facets.put(item.optInt("id"),str(item,"name"));}
        }
        List<Map.Entry<Integer,String>> entries=new ArrayList<>(facets.entrySet());
        Collator collator=Collator.getInstance(TR);entries.sort((x,y)->x.getKey().equals(y.getKey())?0:x.getKey()==0?-1:y.getKey()==0?1:naturalCompare(collator,x.getValue(),y.getValue()));
        searchableChoice("author".equals(relation)?"Yazar seç":"series".equals(relation)?"Seri seç":"Tür seç",entries,e->{
            Filter next=f.copy();
            if("author".equals(relation)){next.author=e.getKey();next.authorName=e.getValue();}
            else if("series".equals(relation)){next.series=e.getKey();next.seriesName=e.getValue();}
            else{next.genre=e.getKey();next.genreName=e.getValue();}
            library(next,1);
        });
    }
    private void searchableChoice(String title,List<Map.Entry<Integer,String>> entries,Consumer<Map.Entry<Integer,String>> selected) {
        LinearLayout wrap=a.column();wrap.setPadding(a.dp(16),a.dp(8),a.dp(16),0);
        wrap.setBackgroundColor(BG);
        EditText search=new EditText(new android.view.ContextThemeWrapper(a,android.R.style.Theme_Material));search.setSingleLine(true);search.setHint("Ara");search.setTextColor(FG);search.setHintTextColor(MUTED);search.setTypeface(a.font("bricolage",400));wrap.addView(search);
        ListView list=new ListView(a);wrap.addView(list,new LinearLayout.LayoutParams(-1,a.dp(350)));
        List<Map.Entry<Integer,String>> shown=new ArrayList<>(entries);
        ArrayAdapter<String> adapter=new ArrayAdapter<String>(a,android.R.layout.simple_list_item_1,new ArrayList<>()){
            @Override public View getView(int position,View reuse,ViewGroup parent){TextView view=(TextView)super.getView(position,reuse,parent);view.setTextColor(FG);view.setTypeface(a.font("bricolage",400));return view;}
        };list.setAdapter(adapter);
        Runnable refresh=()->{String q=search.getText().toString().toLowerCase(TR).trim();shown.clear();adapter.clear();for(Map.Entry<Integer,String> entry:entries)if(q.isEmpty()||entry.getKey()==0||entry.getValue().toLowerCase(TR).contains(q)){shown.add(entry);adapter.add(entry.getValue());}adapter.notifyDataSetChanged();};
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){refresh.run();}public void afterTextChanged(Editable e){}});refresh.run();
        AlertDialog dialog=dialog().setTitle(title).setView(wrap).setNegativeButton("Vazgeç",null).create();
        list.setOnItemClickListener((parent,view,pos,id)->{Map.Entry<Integer,String> entry=shown.get(pos);dialog.dismiss();selected.accept(entry);});dialog.show();
    }

    private void detail(int id) {
        LinearLayout shell=page("","",1,()->detail(id));
        TextView wait=loading(shell);
        a.get(MANAGE+"?view=book&id="+id,data->{
            shell.removeView(wait);JSONObject b=data.optJSONObject("book");
            if(b==null){note(shell,"Kitap bulunamadı.");return;}
            LinearLayout layout=widthDp()>=768?a.row():a.column();layout.setGravity(Gravity.TOP);shell.addView(layout,new LinearLayout.LayoutParams(-1,-2));
            LinearLayout artwork=a.column();LinearLayout.LayoutParams artLp=new LinearLayout.LayoutParams(a.dp(widthDp()>=768?256:224),-2);artLp.gravity=Gravity.CENTER_HORIZONTAL;
            if(widthDp()>=768)artLp.rightMargin=a.dp(40);else artLp.bottomMargin=a.dp(40);layout.addView(artwork,artLp);
            if(b.optBoolean("hasCover"))coverImage(artwork,ROOT+"/api/books/"+id+"/cover?v="+a.enc(str(b,"updatedAt")),widthDp()>=768?384:336,()->a.photo(ROOT+"/api/books/"+id+"/cover?v="+a.enc(str(b,"updatedAt")),str(b,"title")));
            else {TextView fallback=text(str(b,"title"),24,FG);fallback.setGravity(Gravity.CENTER);fallback.setPadding(a.dp(20),a.dp(20),a.dp(20),a.dp(20));fallback.setBackground(outline(hsl(b.optInt("coverHue",235),.46f,.24f),8));artwork.addView(fallback,new LinearLayout.LayoutParams(-1,a.dp(widthDp()>=768?384:336)));}
            LinearLayout p=a.column();layout.addView(p,widthDp()>=768?new LinearLayout.LayoutParams(0,-2,1):new LinearLayout.LayoutParams(-1,-2));
            TextView bookTitle=title(p,str(b,"title"));bookTitle.setTextSize(36);bookTitle.setPadding(0,0,0,a.dp(12));
            if(b.optInt("authorId")>0){TextView author=text(name(b,"author"),18,0xffb7c0ff);author.setPadding(0,0,0,a.dp(16));p.addView(author);author.setOnClickListener(v->{Filter f=new Filter();f.author=b.optInt("authorId");f.authorName=name(b,"author");a.navigate(()->library(f,1));});}
            JSONObject progress=object(b,"progress");int percent=(int)Math.round(progress.optDouble("percent",0)*100);
            String file=ROOT+"/api/books/"+id+"/file";
            boolean on=b.optBoolean("koboSync");
            String[] actionLabels={percent>0?"Okumaya devam et (%"+percent+")":"Oku","İndir ("+str(b,"format").toUpperCase(TR)+", "+a.bytes(b.optDouble("sizeBytes",0))+")",on?"Kobo listesinden çıkar":"Kobo’ya ekle","Kitap bilgilerini düzenle"};
            Runnable[] clicks={()->a.readBook(b),()->a.download(file+"?download=1",filename(b),mime(b)),()->mutate(a.obj("action","kobo","id",id,"on",String.valueOf(!on)),r->detail(id)),()->a.navigate(()->edit(b))};
            LinearLayout actionRow=null;int columns=widthDp()>=640?2:1;
            for(int n=0;n<4;n++){
                if(n%columns==0){actionRow=a.row();p.addView(actionRow,new LinearLayout.LayoutParams(-1,-2));}
                TextView control=button(actionRow,actionLabels[n],clicks[n]);control.setGravity(Gravity.CENTER);control.setMinHeight(a.dp(48));
                LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-1,1);lp.setMargins(0,0,n%columns<columns-1?a.dp(12):0,a.dp(12));control.setLayoutParams(lp);
                if(n==0){control.setBackground(a.shape(SIGNAL,8));control.setTextColor(BG);}
            }
            if(b.optInt("seriesId")>0)button(p,"Seri: "+name(b,"series")+(b.isNull("seriesIndex")?"":" · "+str(b,"seriesIndex"))+" · Tüm kitaplar",()->{Filter f=new Filter();f.series=b.optInt("seriesId");f.seriesName=name(b,"series");a.navigate(()->library(f,1));});
            JSONArray genres=array(b,"genres");
            for(int i=0;i<genres.length();i++){JSONObject g=genres.optJSONObject(i);if(g!=null)button(p,"Tür: "+str(g,"name"),()->{Filter f=new Filter();f.genre=g.optInt("id");f.genreName=str(g,"name");a.navigate(()->library(f,1));});}
            if(!str(b,"description").isEmpty()){
                TextView desc=text(android.text.Html.fromHtml(str(b,"description"),android.text.Html.FROM_HTML_MODE_COMPACT).toString(),18,FG);
                desc.setTypeface(a.font("serif",400));desc.setLineSpacing(0,1.625f);desc.setPadding(0,a.dp(20),0,0);p.addView(desc);
            }
            trackingPanel(p,b,object(data,"tracking"));
            title(p,"Dosya ve yayın bilgileri");
            for(String key:new String[]{"publisher","year","language"})if(!str(b,key).isEmpty())note(p,("publisher".equals(key)?"Yayınevi: ":"year".equals(key)?"Yıl: ":"Dil: ")+str(b,key));
            note(p,str(b,"format").toUpperCase(TR)+" · "+a.bytes(b.optDouble("sizeBytes",0))+"\n"+str(b,"relPath"));
            note(p,"Kitap bilgileri: "+(b.optBoolean("metadataLocked")?"elle düzenlenmiş, taramada korunur":"otomatik")+" · Kapak: "+(b.optBoolean("coverLocked")?"korunuyor":"otomatik"));
        });
    }
    private void trackingPanel(LinearLayout parent,JSONObject b,JSONObject tracking) {
        int id=b.optInt("id");JSONObject entry=object(tracking,"entry");
        LinearLayout p=a.column();p.setPadding(a.dp(16),a.dp(6),a.dp(16),a.dp(16));p.setBackground(outline(SURFACE,12));
        LinearLayout.LayoutParams panelLp=new LinearLayout.LayoutParams(-1,-2);panelLp.setMargins(0,a.dp(32),0,a.dp(16));parent.addView(p,panelLp);TextView heading=title(p,"Takip");heading.setTextSize(14);
        ChipFlow statuses=new ChipFlow();statuses.setContentDescription("Okuma durumu");p.addView(statuses,new LinearLayout.LayoutParams(-1,-2));
        String[] keys={"reading","want","read","dropped"};String[] labels={"Okunuyor","Okumak istiyorum","Okundu","Yarıda bıraktım"};
        for(int i=0;i<keys.length;i++){
            String key=keys[i];boolean selected=key.equals(str(entry,"status"));
            TextView chip=text((selected?"✓ ":"")+labels[i],14,selected?BG:FG);chip.setGravity(Gravity.CENTER);chip.setMinHeight(a.dp(40));chip.setPadding(a.dp(16),a.dp(8),a.dp(16),a.dp(8));chip.setBackground(selected?a.shape(SIGNAL,8):outline(BG,8));chip.setSelected(selected);chip.setContentDescription(labels[i]+(selected?", seçili":""));statuses.addView(chip,new ViewGroup.LayoutParams(-2,-2));
            chip.setOnClickListener(v->mutate(a.obj("action","status","id",id,"status",selected?"":key),r->detail(id)));
        }
        a.space(p,20);LinearLayout rating=a.row();rating.setGravity(Gravity.CENTER_VERTICAL);p.addView(rating);
        TextView ratingLabel=text("Puanın",14,MUTED);ratingLabel.setPadding(0,0,a.dp(12),0);rating.addView(ratingLabel);
        int currentRating=entry.optInt("rating",0);
        for(int i=1;i<=5;i++){
            final int value=i;TextView star=text(i<=currentRating?"★":"☆",27,i<=currentRating?0xffffb547:LINE);star.setGravity(Gravity.CENTER);star.setSelected(i==currentRating);star.setContentDescription(i+" yıldız"+(i==currentRating?", seçili; yeniden basarak kaldır":""));
            rating.addView(star,new LinearLayout.LayoutParams(a.dp(40),a.dp(44)));star.setOnClickListener(v->mutate(a.obj("action","rating","id",id,"rating",currentRating==value?0:value),r->detail(id)));
        }
        TextView shelvesTitle=title(p,"Raflarım");shelvesTitle.setTextSize(14);JSONArray shelves=array(tracking,"shelves"),mine=array(tracking,"shelfIds");
        ChipFlow shelfChips=new ChipFlow();p.addView(shelfChips,new LinearLayout.LayoutParams(-1,-2));
        for(int i=0;i<shelves.length();i++){JSONObject shelf=shelves.optJSONObject(i);if(shelf==null)continue;int shelfId=shelf.optInt("id");boolean selected=has(mine,shelfId);
            TextView chip=text(str(shelf,"name"),14,selected?0xffffb547:FG);chip.setPadding(a.dp(12),a.dp(7),a.dp(12),a.dp(7));chip.setMinHeight(a.dp(36));chip.setGravity(Gravity.CENTER);chip.setBackground(outline(selected?0x26ffb547:BG,100));chip.setSelected(selected);chip.setContentDescription(str(shelf,"name")+(selected?", seçili":""));shelfChips.addView(chip,new ViewGroup.LayoutParams(-2,-2));chip.setOnClickListener(v->mutate(a.obj("action","shelf","id",id,"shelfId",shelfId,"on",String.valueOf(!selected)),r->detail(id)));
        }
        a.space(p,12);LinearLayout create=a.row();create.setGravity(Gravity.CENTER_VERTICAL);p.addView(create);
        EditText shelfName=new EditText(new android.view.ContextThemeWrapper(a,android.R.style.Theme_Material));shelfName.setTextColor(FG);shelfName.setHintTextColor(MUTED);shelfName.setTextSize(14);shelfName.setTypeface(a.font("bricolage",400));shelfName.setHint("Yeni raf (ör. Favoriler)");shelfName.setContentDescription("Yeni raf adı");shelfName.setSingleLine(true);shelfName.setFilters(new InputFilter[]{new InputFilter.LengthFilter(40)});shelfName.setPadding(a.dp(12),a.dp(10),a.dp(12),a.dp(10));shelfName.setBackground(outline(BG,8));create.addView(shelfName,new LinearLayout.LayoutParams(0,a.dp(44),1));
        TextView add=button(create,"+ Ekle",()->{String clean=shelfName.getText().toString().replaceAll("\\s+"," ").trim();if(clean.isEmpty())return;mutate(a.obj("action","createShelf","name",clean),r->{int shelfId=r.optInt("id");if(shelfId>0)mutate(a.obj("action","shelf","id",id,"shelfId",shelfId,"on","true"),result->detail(id));});});
        LinearLayout.LayoutParams addLp=new LinearLayout.LayoutParams(-2,a.dp(44));addLp.leftMargin=a.dp(8);add.setLayoutParams(addLp);add.setEnabled(false);add.setAlpha(.5f);
        shelfName.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){boolean valid=!s.toString().trim().isEmpty();add.setEnabled(valid);add.setAlpha(valid?1:.5f);}public void afterTextChanged(Editable value){}});
    }
    /** Native flex-wrap equivalent for the site's inline status controls. */
    private final class ChipFlow extends ViewGroup {
        ChipFlow(){super(a);}
        @Override protected void onMeasure(int widthSpec,int heightSpec){
            int width=MeasureSpec.getSize(widthSpec),x=0,y=0,line=0,gap=a.dp(8);
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);child.measure(MeasureSpec.makeMeasureSpec(width,MeasureSpec.AT_MOST),MeasureSpec.makeMeasureSpec(0,MeasureSpec.UNSPECIFIED));int w=child.getMeasuredWidth(),h=child.getMeasuredHeight();if(x>0&&x+w>width){x=0;y+=line+gap;line=0;}x+=w+gap;line=Math.max(line,h);}
            setMeasuredDimension(resolveSize(width,widthSpec),resolveSize(y+line,heightSpec));
        }
        @Override protected void onLayout(boolean changed,int left,int top,int right,int bottom){
            int x=0,y=0,line=0,gap=a.dp(8),width=right-left;
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);int w=child.getMeasuredWidth(),h=child.getMeasuredHeight();if(x>0&&x+w>width){x=0;y+=line+gap;line=0;}child.layout(x,y,x+w,y+h);x+=w+gap;line=Math.max(line,h);}
        }
    }
    private void tracking(String status,int shelfId,int page) {
        LinearLayout p=page("Takip & Raflar","Okumaların, puanların ve kişisel rafların",2,()->tracking(status,shelfId,page));
        String path=MANAGE+"?view=tracking&page="+page+(status.isEmpty()?"":"&status="+status)+(shelfId==0?"":"&shelfId="+shelfId);
        TextView wait=loading(p);
        a.get(path,data->{
            p.removeView(wait);JSONObject overview=object(data,"overview"),counts=object(overview,"counts");
            title(p,"Okuma özeti");
            note(p,"Bu yıl "+overview.optInt("readThisYear")+" kitap okudun · Ortalama puan: "+(overview.isNull("avgRating")?"—":String.format(TR,"%.1f ★",overview.optDouble("avgRating"))));
            String[] statusNames={"Tümü","İstek · "+counts.optInt("want"),"Okunuyor · "+counts.optInt("reading"),"Okundu · "+counts.optInt("read"),"Bırakıldı · "+counts.optInt("dropped")};
            int selected=0;for(int i=0;i<STATUS.length;i++)if(shelfId==0&&STATUS[i].equals(status))selected=i+1;
            segments(p,"",statusNames,selected,n->tracking(n==0?"":STATUS[n-1],0,1));
            button(p,"Kobo cihazı ve gönderim listesi",()->a.navigate(()->kobo(1)));
            title(p,"Özel raflar");JSONArray shelves=array(overview,"shelves");String selectedName="";
            for(int i=0;i<shelves.length();i++){JSONObject shelf=shelves.optJSONObject(i);if(shelf==null)continue;int sid=shelf.optInt("id");String shelfName=str(shelf,"name");if(sid==shelfId)selectedName=shelfName;
                button(p,(sid==shelfId?"✓ ":"")+shelfName+" · "+object(shelf,"_count").optInt("books"),()->tracking("",sid,1));
            }
            button(p,"Yeni raf oluştur",()->newShelf(id->tracking("",id,1)));
            if(shelfId>0){String label=selectedName;button(p,"Bu rafı sil",()->confirm("Rafı sil: "+label,"Yalnızca raf ve raf üyelikleri kaldırılır; kitap dosyaları silinmez.",()->mutate(a.obj("action","deleteShelf","shelfId",shelfId),r->tracking("",0,1))));}
            title(p,(shelfId>0?selectedName:status.isEmpty()?"Takip edilen kitaplar":statusLabel(status))+" · "+data.optInt("total"));
            JSONArray books=array(data,"books");if(books.length()==0)note(p,"Bu rafta henüz kitap yok. Kitap ayrıntılarından kitap ekleyebilirsin.");else bookRows(p,books,false);
            pagination(p,data.optInt("page",page),data.optInt("pages",1),n->tracking(status,shelfId,n));
        });
    }
    private void newShelf(Consumer<Integer> done) {
        prompt("Yeni raf adı (en fazla 40 karakter)","",value->{String clean=value.replaceAll("\\s+"," ").trim();if(clean.isEmpty()||clean.length()>40){a.toast("1–40 karakter uzunluğunda bir raf adı girin.");return;}mutate(a.obj("action","createShelf","name",clean),r->{int id=r.optInt("id");if(id>0)done.accept(id);else a.toast("Raf kimliği alınamadı; rafları yenileyin.");});});
    }
    private void kobo(int page) {
        LinearLayout p=page("Kobo","Cihazına yerel ağdan kitap gönder",3,()->kobo(page));TextView wait=loading(p);
        a.get(MANAGE+"?view=kobo&page="+page,data->{
            p.removeView(wait);title(p,"Kobo’yu bağla");
            note(p,"1. Kobo’yu USB ile bilgisayarına bağla ve .kobo/Kobo/Kobo eReader.conf dosyasını yedekle.\n2. [OneStoreServices] bölümündeki api_endpoint satırını aşağıdaki adresle değiştir.\n3. Güvenle çıkar, telefon ve sunucuyla aynı Wi-Fi ağına bağla; Kobo’da Eşitle’ye bas.");
            String endpoint=str(data,"endpoint");
            if(!endpoint.isEmpty()){
                TextView config=text("[OneStoreServices]\napi_endpoint="+endpoint,13,FG);config.setTypeface(Typeface.MONOSPACE);config.setTextIsSelectable(true);p.addView(config);
                button(p,"Kurulum satırını kopyala",()->{ClipboardManager clipboard=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);if(clipboard!=null){clipboard.setPrimaryClip(ClipData.newPlainText("Kobo kurulumu","[OneStoreServices]\napi_endpoint="+endpoint));a.toast("Kobo kurulumu kopyalandı.");}});
            }
            note(p,"Bu adres kişisel eşitleme anahtarını içerir. Kobo mağazasına dönmek için yedeğini geri yükle veya api_endpoint değerini https://storeapi.kobo.com yap.");
            title(p,"Kobo’ya gönderilecekler · "+data.optInt("total"));JSONArray books=array(data,"books");
            if(books.length()==0)note(p,"Kitap ayrıntılarından Kobo’ya ekle düğmesiyle kitap seç.");else bookRows(p,books,true);
            pagination(p,data.optInt("page",page),data.optInt("pages",1),this::kobo);
        });
    }

    private void edit(JSONObject book) {
        int id=book.optInt("id");LinearLayout p=page("Kitabı düzenle",str(book,"title"),-1,()->edit(book));
        note(p,"Kaydettiğin bilgiler ve kapak sonraki HDD taramalarında korunur. Boş bıraktığın alanlar temizlenir.");
        if(book.optBoolean("hasCover"))coverImage(p,ROOT+"/api/books/"+id+"/cover?v="+a.enc(str(book,"updatedAt")),180,null);
        Map<String,EditText> inputs=new LinkedHashMap<>();
        field(p,inputs,"title","Kitap adı *",str(book,"title"),300,false);
        field(p,inputs,"author","Yazar",name(book,"author"),200,false);
        field(p,inputs,"series","Seri",name(book,"series"),200,false);
        field(p,inputs,"seriesIndex","Seri sırası",str(book,"seriesIndex"),40,false);
        List<String> genreNames=new ArrayList<>();JSONArray genres=array(book,"genres");for(int i=0;i<genres.length();i++)genreNames.add(str(genres.optJSONObject(i),"name"));
        field(p,inputs,"genres","Türler (virgül veya yeni satırla ayır)",String.join(", ",genreNames),1000,true);
        field(p,inputs,"language","Dil",str(book,"language"),100,false);
        field(p,inputs,"publisher","Yayınevi",str(book,"publisher"),200,false);
        field(p,inputs,"year","Yayın yılı (0–9999)",str(book,"year"),4,false);
        field(p,inputs,"description","Açıklama",str(book,"description"),20000,true);
        if(catalog!=null)applySuggestions(inputs,catalog);
        else button(p,"Yazar, seri, tür ve yayın bilgileri için kitaplıktan önerileri yükle",()->{
            TextView wait=loading(p);
            fetchAll(new Filter(),1,new JSONArray(),wait,books->{p.removeView(wait);catalog=books;applySuggestions(inputs,books);a.toast("Öneriler hazır. Alanlara yazarak kitaplıktan seçim yapabilirsin.");});
        });
        inputs.get("year").setInputType(InputType.TYPE_CLASS_NUMBER);
        inputs.get("seriesIndex").setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL|InputType.TYPE_NUMBER_FLAG_SIGNED);
        TextView error=text("",14,SIGNAL);p.addView(error);
        Consumer<Boolean> save=withCover->{
            JSONObject fields=metadata(id,inputs,error);if(fields==null)return;
            if(withCover)pickUpload("cover",fields,"image/*",12L*1024*1024,r->{catalog=null;detail(id);});
            else mutate(fields,r->{catalog=null;detail(id);});
        };
        button(p,"Değişiklikleri kaydet",()->save.accept(false));
        button(p,"Kapak seç ve tüm değişiklikleri kaydet",()->save.accept(true));
        note(p,"Kapak: JPG, PNG veya WebP · en fazla 12 MB. Kapak seçimi tamamlanınca formdaki bilgiler de kaydedilir.");
        button(p,"Vazgeç",a::back);
        title(p,"Dosya bilgileri");note(p,str(book,"format").toUpperCase(TR)+" · "+a.bytes(book.optDouble("sizeBytes",0))+"\n"+str(book,"relPath"));
    }
    private void field(LinearLayout p,Map<String,EditText> fields,String key,String label,String value,int max,boolean multiline) {
        TextView caption=text(label,14,MUTED);caption.setPadding(0,a.dp(12),0,a.dp(3));p.addView(caption);
        EditText input;
        Context fieldContext=new android.view.ContextThemeWrapper(a,android.R.style.Theme_Material);
        if("genres".equals(key)){MultiAutoCompleteTextView multi=new MultiAutoCompleteTextView(fieldContext);multi.setTokenizer(new MultiAutoCompleteTextView.CommaTokenizer());input=multi;}
        else if("author".equals(key)||"series".equals(key)||"language".equals(key)||"publisher".equals(key))input=new AutoCompleteTextView(fieldContext);
        else input=new EditText(fieldContext);
        input.setText(value);input.setTextSize(16);input.setTextColor(FG);input.setHintTextColor(MUTED);
        input.setTypeface(a.font("bricolage",400));input.setBackground(outline(SURFACE,8));input.setPadding(a.dp(12),a.dp(12),a.dp(12),a.dp(12));input.setMinHeight(a.dp(48));
        if(input instanceof AutoCompleteTextView)((AutoCompleteTextView)input).setDropDownBackgroundDrawable(outline(SURFACE,8));
        input.setFilters(new InputFilter[]{new InputFilter.LengthFilter(max)});
        input.setInputType(InputType.TYPE_CLASS_TEXT|(multiline?InputType.TYPE_TEXT_FLAG_MULTI_LINE:InputType.TYPE_TEXT_FLAG_CAP_SENTENCES));
        input.setSingleLine(!multiline);if(multiline){input.setMinLines("description".equals(key)?5:2);input.setGravity(Gravity.TOP);}
        input.setContentDescription(label);caption.setLabelFor(View.generateViewId());input.setId(caption.getLabelFor());
        p.addView(input,new LinearLayout.LayoutParams(-1,-2));fields.put(key,input);
    }
    private void applySuggestions(Map<String,EditText> inputs,JSONArray books) {
        for(String key:new String[]{"author","series","genres","language","publisher"}){
            TreeSet<String> options=new TreeSet<>(Collator.getInstance(TR));
            for(int i=0;i<books.length();i++){
                JSONObject b=books.optJSONObject(i);if(b==null)continue;
                if("genres".equals(key)){JSONArray genres=array(b,"genres");for(int j=0;j<genres.length();j++){String n=str(genres.optJSONObject(j),"name");if(!n.trim().isEmpty())options.add(n);}}
                else {String n=("author".equals(key)||"series".equals(key))?name(b,key):str(b,key);if(!n.trim().isEmpty())options.add(n);}
            }
            EditText input=inputs.get(key);
            if(input instanceof AutoCompleteTextView){AutoCompleteTextView auto=(AutoCompleteTextView)input;auto.setThreshold(1);auto.setAdapter(new ArrayAdapter<String>(auto.getContext(),android.R.layout.simple_dropdown_item_1line,new ArrayList<>(options)){
                @Override public View getView(int position,View reuse,ViewGroup parent){TextView t=(TextView)super.getView(position,reuse,parent);t.setTextColor(FG);t.setTypeface(a.font("bricolage",400));return t;}
            });}
        }
    }
    private JSONObject metadata(int id,Map<String,EditText> inputs,TextView error) {
        error.setText("");
        if(inputs.get("title").getText().toString().trim().isEmpty()){invalid(inputs.get("title"),error,"Kitap adı boş bırakılamaz.");return null;}
        String year=inputs.get("year").getText().toString().trim(),index=inputs.get("seriesIndex").getText().toString().trim();
        try{if(!year.isEmpty()){int n=Integer.parseInt(year);if(n<0||n>9999)throw new NumberFormatException();}}catch(NumberFormatException e){invalid(inputs.get("year"),error,"Yıl 0–9999 arasında tam sayı olmalı.");return null;}
        try{if(!index.isEmpty()&&!Double.isFinite(Double.parseDouble(index)))throw new NumberFormatException();}catch(NumberFormatException e){invalid(inputs.get("seriesIndex"),error,"Seri sırası geçerli bir sayı olmalı (ör. 1.5).");return null;}
        JSONObject data=a.obj("action","metadata","id",id);for(Map.Entry<String,EditText> e:inputs.entrySet())try{data.put(e.getKey(),e.getValue().getText().toString());}catch(Exception ignored){}return data;
    }
    private void invalid(EditText input,TextView error,String message){input.setError(message);input.requestFocus();error.setText(message);a.toast(message);}

    private void scan() {
        confirm("HDD kitaplığını tara","Yeni kitaplar ve kapaklar içeri alınır, değişiklikler taranır. Diskte artık bulunmayan kayıtlar kaldırılabilir. Tarama birkaç dakika sürebilir.",()->{
            if(writing){a.toast("Önce devam eden işlemin bitmesini bekleyin.");return;}
            send("POST",ROOT+"/api/scan",null,null,null,0,result->{
                catalog=null;
                JSONArray errors=array(result,"errors");StringBuilder text=new StringBuilder("Eklenen: "+result.optInt("added")+"\nGüncellenen: "+result.optInt("updated")+"\nKaldırılan: "+result.optInt("removed")+"\nDeğişmeyen: "+result.optInt("unchanged")+"\nSüre: "+String.format(TR,"%.1f sn",result.optDouble("tookMs")/1000)+"\nHatalar: "+errors.length());
                for(int i=0;i<Math.min(errors.length(),10);i++){JSONObject e=errors.optJSONObject(i);text.append("\n").append(str(e,"file")).append(": ").append(str(e,"message"));}
                dialog().setTitle("Tarama tamamlandı").setMessage(text.toString()).setPositiveButton("Kitaplığı yenile",(d,w)->home()).setNegativeButton("Kapat",null).show();
            });
        });
    }
    private void uploadBook() {
        a.get(MANAGE+"?view=upload",state->{
            if(!state.optBoolean("writable")){a.toast(str(state,"reason").isEmpty()?"Kitaplık şu anda yazılabilir değil.":str(state,"reason"));return;}
            pickUpload("file",a.obj("action","upload"),"*/*",50L*1024*1024,result->{
                catalog=null;String warning=str(result,"warning");
                Runnable next=()->{int id=result.optInt("bookId");if(id>0)openBook(id);else home();};
                if(!warning.isEmpty())dialog().setTitle("Dosya kaydedildi").setMessage(warning).setPositiveButton("Tamam",(d,w)->next.run()).show();
                else{a.toast("Kitap yüklendi: "+str(result,"name"));next.run();}
            });
        });
    }
    private void mutate(JSONObject fields,Consumer<JSONObject> done) {
        send("POST",MANAGE,fields,null,null,0,result->{catalog=null;done.accept(result);});
    }

    /** Picker lives in this module because the shared upload contract has no header option. */
    private void pickUpload(String field,JSONObject fields,String mime,long limit,Consumer<JSONObject> done) {
        if(writing){a.toast("Önce devam eden işlemin bitmesini bekleyin.");return;}
        LinearLayout scope=body;
        Picker picker=new Picker();picker.mime=mime;
        picker.selected=uri->{if(!a.isDestroyed()&&scope.isAttachedToWindow())send("POST",MANAGE,fields,field,uri,limit,done);};
        a.getFragmentManager().beginTransaction().add(picker,"books-picker-"+UUID.randomUUID()).commit();
    }
    public static final class Picker extends Fragment {
        String mime="*/*";Consumer<Uri> selected;
        public Picker() {}
        @Override public void onCreate(Bundle state){super.onCreate(state);if(state!=null){remove();return;}Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.setType(mime);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);try{startActivityForResult(pick,91);}catch(Exception e){Activity a=getActivity();if(a instanceof MainActivity)((MainActivity)a).toast("Dosya seçici açılamadı.");remove();}}
        @Override public void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==91&&result==Activity.RESULT_OK&&data!=null&&data.getData()!=null&&selected!=null)selected.accept(data.getData());remove();}
        private void remove(){if(getFragmentManager()!=null)getFragmentManager().beginTransaction().remove(this).commitAllowingStateLoss();}
    }
    private void send(String method,String path,JSONObject fields,String fileField,Uri uri,long limit,Consumer<JSONObject> done) {
        if(writing){a.toast("Önce devam eden işlemin bitmesini bekleyin.");return;}
        writing=true;LinearLayout scope=body;
        final Runnable refresh=reloadPage;
        final String server=a.base();
        TextView progress=text(uri==null?"İşlem sürüyor…":"Dosya yükleniyor…",14,SIGNAL);scope.addView(progress);
        IO.execute(()->{
            HttpURLConnection c=null;
            try{
                c=(HttpURLConnection)new URL(server.replaceAll("/+$","")+path).openConnection();
                c.setRequestMethod(method);c.setConnectTimeout(15000);c.setReadTimeout(path.endsWith("/scan")?3600000:300000);
                c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","Keremhub-Android/1.0");
                c.setRequestProperty("X-Keremhub-Mobile","1");
                // No Origin for a native request. JVM CookieHandler supplies shared LAN cookies.
                if(uri!=null){
                    String name="upload";long size=-1;
                    try(Cursor cursor=a.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){
                        if(cursor!=null&&cursor.moveToFirst()){int ni=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME),si=cursor.getColumnIndex(OpenableColumns.SIZE);if(ni>=0)name=cursor.getString(ni);if(si>=0&&!cursor.isNull(si))size=cursor.getLong(si);}
                    }
                    if(name==null||name.trim().isEmpty())throw new IOException("Dosya adı okunamadı.");
                    if(size==0||size>limit)throw new IOException("Dosya boş veya "+(limit/1048576)+" MB sınırını aşıyor.");
                    String lower=name.toLowerCase(Locale.ROOT);
                    if("file".equals(fileField)&&!(lower.endsWith(".epub")||lower.endsWith(".kepub")||lower.endsWith(".pdf")))throw new IOException("EPUB, KEPUB veya PDF dosyası seçin.");
                    String boundary="KeremBooks"+UUID.randomUUID().toString().replace("-","");
                    c.setDoOutput(true);c.setChunkedStreamingMode(64*1024);c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
                    try(OutputStream out=c.getOutputStream()){
                        Iterator<String> keys=fields.keys();while(keys.hasNext()){String key=keys.next();write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\""+key+"\"\r\n\r\n"+str(fields,key)+"\r\n");}
                        String safeName=name.replace("\\","_").replace("\"","_").replace("\r","_").replace("\n","_");
                        write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\""+fileField+"\"; filename=\""+safeName+"\"\r\nContent-Type: application/octet-stream\r\n\r\n");
                        try(InputStream in=a.getContentResolver().openInputStream(uri)){
                            if(in==null)throw new IOException("Dosya açılamadı.");byte[] buffer=new byte[64*1024];long count=0;int n;
                            while((n=in.read(buffer))!=-1){count+=n;if(count>limit)throw new IOException("Dosya "+(limit/1048576)+" MB sınırını aşıyor.");out.write(buffer,0,n);}
                            if(count==0)throw new IOException("Dosya boş.");
                        }
                        write(out,"\r\n--"+boundary+"--\r\n");
                    }
                }else if(fields!=null){
                    StringBuilder encoded=new StringBuilder();Iterator<String> keys=fields.keys();while(keys.hasNext()){String key=keys.next();if(encoded.length()>0)encoded.append('&');encoded.append(java.net.URLEncoder.encode(key,"UTF-8")).append('=').append(java.net.URLEncoder.encode(str(fields,key),"UTF-8"));}
                    byte[] bytes=encoded.toString().getBytes(StandardCharsets.UTF_8);c.setDoOutput(true);c.setFixedLengthStreamingMode(bytes.length);c.setRequestProperty("Content-Type","application/x-www-form-urlencoded; charset=UTF-8");try(OutputStream out=c.getOutputStream()){out.write(bytes);}
                }
                int status=c.getResponseCode();String response;
                InputStream input=status>=400?c.getErrorStream():c.getInputStream();
                if(input==null)response="";else try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);response=out.toString("UTF-8");}
                JSONObject result;try{result=new JSONObject(response);}catch(Exception e){throw new IOException("Sunucu beklenen JSON yanıtını vermedi (HTTP "+status+"). Oturum ve bağlantıyı kontrol edin.");}
                if(status>=400||result.has("error"))throw new IOException(str(result,"error").isEmpty()?"Sunucu hatası (HTTP "+status+")":str(result,"error"));
                MAIN.post(()->{writing=false;if(!a.isDestroyed()&&scope.isAttachedToWindow()){scope.removeView(progress);done.accept(result);}});
            }catch(Exception e){
                String message=e.getMessage()==null?"İşlem tamamlanamadı.":e.getMessage();
                MAIN.post(()->{writing=false;if(!a.isDestroyed()&&scope.isAttachedToWindow()){progress.setText("İşlem doğrulanamadı: "+message+"\nTekrar denemeden önce görünümü yenileyin.");if(refresh!=null)button(scope,"Görünümü yenile",refresh);a.toast(message);}});
            }finally{if(c!=null)c.disconnect();}
        });
    }
    private static void write(OutputStream out,String value)throws IOException{out.write(value.getBytes(StandardCharsets.UTF_8));}
}
