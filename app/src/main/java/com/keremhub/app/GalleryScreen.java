package com.keremhub.app;

import android.app.AlertDialog;
import android.app.Dialog;
import android.app.Fragment;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.graphics.Movie;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.Animatable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.media.ExifInterface;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

/** Native client for inspection/xxxkerem. All writes are user initiated; opening
 * this module performs GETs only. View counters are sent when media is opened.
 * The mobile API lacks seed/unassigned/neighbors/recommendations: those are
 * derived from complete, deduplicated, non-random pages, never an HTML page. */
public final class GalleryScreen {
    private static final String BASE = "/xxxkerem";
    private static final String[] SORTS = {"new", "views", "title", "random"};
    private static final String[] SORT_LABELS = {"En yeni", "En çok izlenen", "A–Z", "Rastgele"};
    private static final Locale TR = Locale.forLanguageTag("tr");
    private static final java.util.concurrent.ExecutorService IMAGE_IO=java.util.concurrent.Executors.newFixedThreadPool(2,r->{Thread t=new Thread(r,"gallery-image");t.setDaemon(true);return t;});
    private final MainActivity a;
    private LinearLayout body;
    private volatile int revision;
    private EditText headerSearch;
    private Consumer<String> searchSubmit;
    private Runnable extraMenu;
    private Query activeQuery;
    private int activeTab;
    private TextView totalLabel;
    private LinearLayout tabStrip;
    private static final int INK=0xff1b1b1b, PANEL=0xff292929, MUTED=0xff808080, BRAND=0xffffa31a;
    private TextView label(String value,int size,int color,int weight) {
        TextView t=a.text(value,size,color);t.setTypeface(a.font("inter",weight));
        t.setIncludeFontPadding(false);t.setLineSpacing(0,1.2f);return t;
    }

    private GalleryScreen(MainActivity activity) { a = activity; }
    public static void show(MainActivity a) { new GalleryScreen(a).home(); }

    private static JSONArray array(JSONObject o, String key) {
        JSONArray v = o.optJSONArray(key); return v == null ? new JSONArray() : v;
    }
    private static List<JSONObject> rows(JSONArray array) {
        List<JSONObject> out = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) if (array.optJSONObject(i) != null) out.add(array.optJSONObject(i));
        return out;
    }
    private String api(String suffix) { return BASE + "/api" + suffix; }
    private void add(LinearLayout parent,String text,int size,int color) { parent.addView(label(text,size,color,size>=18?700:400)); }
    private TextView action(LinearLayout parent,String text,Runnable click) {
        TextView b=label(text,14,a.ink,600);b.setGravity(Gravity.CENTER);b.setMinHeight(a.dp(36));
        b.setPadding(a.dp(12),a.dp(8),a.dp(12),a.dp(8));b.setBackground(a.shape(PANEL,6));
        b.setFocusable(true);b.setOnClickListener(v->click.run());
        LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(parent.getOrientation()==LinearLayout.HORIZONTAL?-2:-1,-2);
        lp.setMargins(0,a.dp(4),parent.getOrientation()==LinearLayout.HORIZONTAL?a.dp(6):0,a.dp(4));parent.addView(b,lp);return b;
    }
    private LinearLayout surface(LinearLayout parent) {
        LinearLayout c=a.column();LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);
        lp.bottomMargin=a.dp(16);parent.addView(c,lp);return c;
    }
    private View icon(String name,int size,int color,Runnable click,String description) {
        View v=Ui.icon(a,name,size,color,click);v.setContentDescription(description);return v;
    }
    private void search(String value,Consumer<String> submit) { headerSearch.setText(value);searchSubmit=submit; }
    private void scan(Runnable reload) {
        a.confirm("Kütüphaneyi tara","Sunucudaki medya klasörleri taranacak; eksik dosya kayıtları kaldırılabilir.",()->
            a.request("POST",api("/scan"),a.obj(),r->{a.toast(r.optInt("added")+" yeni, "+r.optInt("removed")+" kaldırıldı · "+r.optInt("errors")+" hata");reload.run();}));
    }
    private void menu(Runnable reload) {
        List<String> names=new ArrayList<>();List<Runnable> tasks=new ArrayList<>();
        if(extraMenu!=null){names.add("Bu sayfanın işlemleri");tasks.add(extraMenu);}
        if(activeQuery!=null){Query current=activeQuery;
            names.add("Profil seçerek filtrele");tasks.add(()->chooseProfile(id->a.navigate(()->{Query n=new Query(current.kind,id);n.sort=current.sort;n.q=current.q;browse(n);})));
            if(current.profile>0){names.add("Profile dön");tasks.add(()->a.navigate(()->profile(current.profile)));}
            if(!current.q.isEmpty()){names.add("Aramayı temizle");tasks.add(()->{Query n=current.reset();n.q="";browse(n);});}
        }
        names.add("Yeni profil oluştur");tasks.add(()->createProfile(id->a.navigate(()->profile(id))));
        names.add("Kütüphaneyi tara");tasks.add(()->scan(reload));names.add("Yenile");tasks.add(reload);
        a.choose("Galeri işlemleri",names.toArray(new String[0]),n->tasks.get(n).run());
    }
    private LinearLayout begin(String title,String subtitle,int tab,Runnable reload) {
        revision++;activeTab=tab;activeQuery=null;extraMenu=null;totalLabel=null;
        a.theme(INK,PANEL,Color.WHITE,MUTED,BRAND);
        body=a.page("","");body.setPadding(a.dp(16),a.dp(20),a.dp(16),a.dp(64));watchPage(body);a.remember(reload);
        LinearLayout pageBody=body;
        pageBody.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int pad=a.dp(a.getResources().getConfiguration().screenWidthDp>=640?24:16);if(pageBody.getPaddingLeft()!=pad){pageBody.setPadding(pad,a.dp(20),pad,a.dp(64));}});
        // Both site header lines stay outside the scrolling archive. Remove the host toolbar.
        a.root.removeViewAt(0);LinearLayout header=a.column();header.setBackgroundColor(INK);
        a.root.addView(header,0,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout top=a.row();top.setPadding(a.dp(16),a.dp(12),a.dp(16),a.dp(12));header.addView(top,new LinearLayout.LayoutParams(-1,a.dp(64)));
        LinearLayout logo=a.row();TextView xxx=label("xxx",24,Color.WHITE,800);xxx.setLetterSpacing(-.05f);logo.addView(xxx);
        TextView kerem=label("kerem",24,INK,800);kerem.setLetterSpacing(-.05f);kerem.setPadding(a.dp(6),a.dp(2),a.dp(6),a.dp(3));kerem.setBackground(a.shape(BRAND,6));
        LinearLayout.LayoutParams word=new LinearLayout.LayoutParams(-2,-2);word.leftMargin=a.dp(3);logo.addView(kerem,word);top.addView(logo);logo.setOnClickListener(v->home());logo.setOnLongClickListener(v->{menu(reload);return true;});logo.setContentDescription("xxxkerem · Videolar; basılı tut: işlemler");
        LinearLayout box=a.row();box.setBackground(a.shape(PANEL,24));LinearLayout.LayoutParams boxLp=new LinearLayout.LayoutParams(0,a.dp(40),1);boxLp.setMargins(a.dp(16),0,a.dp(16),0);top.addView(box,boxLp);
        headerSearch=new EditText(a);headerSearch.setSingleLine(true);headerSearch.setTextSize(14);headerSearch.setTypeface(a.font("inter",400));headerSearch.setTextColor(Color.WHITE);headerSearch.setHintTextColor(MUTED);headerSearch.setBackgroundColor(Color.TRANSPARENT);headerSearch.setPadding(a.dp(16),0,0,0);
        headerSearch.setHint(tab==3?"Profil ara":tab==2?"Fotoğraf ara":"Video ara");headerSearch.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);box.addView(headerSearch,new LinearLayout.LayoutParams(0,-1,1));
        searchSubmit=q->a.navigate(()->{if(tab==3)profiles(q);else{Query n=new Query(tab==2?"IMAGE":"VIDEO",0);n.q=q;browse(n);}});
        Runnable submit=()->{((android.view.inputmethod.InputMethodManager)a.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(headerSearch.getWindowToken(),0);headerSearch.clearFocus();searchSubmit.accept(headerSearch.getText().toString().trim());};
        View magnifier=icon("search",36,INK,submit,"Ara");magnifier.setBackground(a.shape(BRAND,24));LinearLayout.LayoutParams glass=new LinearLayout.LayoutParams(a.dp(36),a.dp(32));glass.setMargins(a.dp(4),0,a.dp(4),0);box.addView(magnifier,glass);headerSearch.setOnEditorActionListener((v,id,event)->{submit.run();return true;});
        View refresh=icon("refresh",40,Color.WHITE,reload,"Yenile; basılı tut: galeri işlemleri");refresh.setBackground(a.shape(PANEL,4));refresh.setOnLongClickListener(v->{menu(reload);return true;});top.addView(refresh);
        View hub=icon("home",40,Color.WHITE,a::hub,"Keremhub’a dön");hub.setBackground(Ui.border(a,PANEL,0xff494949,24));LinearLayout.LayoutParams hubLp=new LinearLayout.LayoutParams(a.dp(44),a.dp(40));hubLp.leftMargin=a.dp(16);top.addView(hub,hubLp);
        HorizontalScrollView tabs=new HorizontalScrollView(a);tabs.setHorizontalScrollBarEnabled(false);tabs.setBackgroundColor(PANEL);LinearLayout row=a.row();tabStrip=row;row.setPadding(a.dp(8),0,a.dp(8),0);tabs.addView(row);header.addView(tabs,new LinearLayout.LayoutParams(-1,a.dp(48)));
        String[] titles={"VİDEOLAR","FOTOĞRAFLAR","PROFİLLER"},icons={"video","photo","users"};
        for(int i=0;i<3;i++){final int index=i+1;boolean selected=tab==index||(tab==0&&index==1);int color=selected?BRAND:Color.WHITE;
            LinearLayout cell=a.column();LinearLayout line=a.row();line.setGravity(Gravity.CENTER);line.setPadding(a.dp(16),0,a.dp(16),0);line.addView(icon(icons[i],20,color,null,titles[i]));TextView caption=label(titles[i],14,color,700);caption.setLetterSpacing(.025f);LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-2,-2);cp.leftMargin=a.dp(8);line.addView(caption,cp);cell.addView(line,new LinearLayout.LayoutParams(-2,a.dp(45)));
            View underline=new View(a);underline.setBackgroundColor(selected?BRAND:Color.TRANSPARENT);cell.addView(underline,new LinearLayout.LayoutParams(-1,a.dp(3)));row.addView(cell);cell.setOnClickListener(v->{if(index==activeTab)return;a.navigate(()->{if(index==3)profiles("");else browse(new Query(index==2?"IMAGE":"VIDEO",0));});});
            if(selected)tabs.post(()->tabs.scrollTo(Math.max(0,cell.getLeft()-a.dp(8)),0));
        }
        top.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int pad=a.dp(a.getResources().getConfiguration().screenWidthDp>=640?24:16);if(top.getPaddingLeft()!=pad)top.setPadding(pad,a.dp(12),pad,a.dp(12));});
        return body;
    }
    private LinearLayout loading(LinearLayout parent) {
        LinearLayout slot = a.column(); parent.addView(slot); a.note(slot, "Yükleniyor… Bağlantı hatasında Yenile ile tekrar deneyin."); return slot;
    }
    private void empty(LinearLayout p, String message) {
        LinearLayout c = surface(p); add(c, message, 17, a.ink); a.note(c, "Aramayı veya filtreleri değiştirin; dosya ekleyebilir ya da kütüphaneyi tarayabilirsiniz.");
    }
    private void home() { browse(new Query("VIDEO",0)); }
    private void preview(LinearLayout p, JSONObject result, String kind) {
        List<JSONObject> list = result == null ? new ArrayList<>() : rows(array(result, "items"));
        if (list.isEmpty()) empty(p, kind.equals("IMAGE") ? "Henüz fotoğraf yok" : "Henüz video yok");
        else mediaGrid(p, list, 0);
    }

    private static final class Query {
        final String kind; final int profile;
        String q = "", sort = "new", seed = UUID.randomUUID().toString();
        int page = 1; boolean unassigned;
        List<JSONObject> snapshot;
        Query(String kind, int profile) { this.kind = kind; this.profile = profile; }
        Query copy() { Query n = new Query(kind, profile); n.q=q; n.sort=sort; n.seed=seed; n.page=page; n.unassigned=unassigned; n.snapshot=snapshot; return n; }
        Query reset() { Query n=copy(); n.page=1; n.snapshot=null; return n; }
    }
    private String listPath(Query s, int page, String sort) {
        return api("/mobile/media?kind=" + s.kind + "&page=" + page + "&sort=" + sort + "&q=" + a.enc(s.q) + (s.profile > 0 ? "&profileId=" + s.profile : ""));
    }
    private void browse(Query s) {
        if(s.profile>0){profile(s.profile,s);return;}
        String label = s.kind.equals("IMAGE") ? "Fotoğraflar" : "Videolar";
        LinearLayout p = begin(label, s.profile > 0 ? "Profil arşivi" : "Kişisel medya arşivi", s.kind.equals("IMAGE") ? 2 : 1, () -> { Query n=s.copy(); n.snapshot=null; browse(n); });
        activeQuery=s;search(s.q,q->{Query n=s.reset();n.q=q;browse(n);});sortBar(p,s,label);
        LinearLayout result = loading(p);
        if (s.unassigned || s.sort.equals("random") || s.snapshot != null) {
            if (s.snapshot != null) renderLocal(result,s);
            else collect(s, result, all -> {
                if(s.unassigned) all.removeIf(m -> array(m,"profiles").length()!=0);
                if(s.sort.equals("random")) { all.sort(Comparator.comparingInt(m -> m.optInt("id"))); shuffle(all,s.seed); }
                s.snapshot=all; renderLocal(result,s);
            });
        } else a.get(listPath(s,s.page,s.sort), data -> {
            result.removeAllViews(); int pages=Math.max(1,data.optInt("pages",1));
            if(s.page>pages) { Query n=s.copy(); n.page=pages; browse(n); return; }
            if(totalLabel!=null)totalLabel.setText("("+data.optInt("total")+")");
            List<JSONObject> list=rows(array(data,"items"));
            if(list.isEmpty()) empty(result,"Sonuç bulunamadı"); else mediaGrid(result,list,s.profile);
            pagination(result,s.page,pages,n -> { Query v=s.copy(); v.page=n; browse(v); });
        });
    }
    private void renderLocal(LinearLayout p, Query s) {
        p.removeAllViews(); int size=s.kind.equals("IMAGE")?48:24;
        int pages=Math.max(1,(s.snapshot.size()+size-1)/size); s.page=Math.min(s.page,pages);
        if(totalLabel!=null)totalLabel.setText("("+s.snapshot.size()+")");
        int start=(s.page-1)*size;
        if(s.snapshot.isEmpty()) empty(p,"Sonuç bulunamadı");
        else mediaGrid(p,s.snapshot.subList(start,Math.min(start+size,s.snapshot.size())),s.profile);
        pagination(p,s.page,pages,n -> { Query v=s.copy(); v.page=n; browse(v); });
    }
    /** Collect only stable sort pages. Deduplication handles concurrent inserts. */
    private void collect(Query s, LinearLayout status, Consumer<List<JSONObject>> done) {
        collectPage(s,1,new LinkedHashMap<>(),status,done,revision);
    }
    private void collectPage(Query s,int page,LinkedHashMap<Integer,JSONObject> all,LinearLayout status,Consumer<List<JSONObject>> done,int token) {
        a.get(listPath(s,page,s.sort.equals("random")?"new":s.sort), data -> {
            if(token!=revision)return;
            for(JSONObject m:rows(array(data,"items"))) if(m.optInt("id")>0)all.put(m.optInt("id"),m);
            int pages=Math.max(1,data.optInt("pages",1));
            if(status!=null){status.removeAllViews(); a.note(status,"Arşiv yükleniyor · " + page+" / "+pages+" · "+all.size()+" kayıt");}
            if(page<pages) collectPage(s,page+1,all,status,done,token); else done.accept(new ArrayList<>(all.values()));
        });
    }
    /** Same SHA-256 + xorshift Fisher–Yates as lib/shuffle.ts. */
    private static void shuffle(List<JSONObject> list,String seed) {
        try {
            byte[] b=MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8));
            int state=(b[0]&255)|((b[1]&255)<<8)|((b[2]&255)<<16)|((b[3]&255)<<24); if(state==0)state=1;
            for(int i=list.size()-1;i>0;i--) { state^=state<<13;state^=state>>>17;state^=state<<5;
                int j=(int)((Integer.toUnsignedLong(state)/4294967296.0)*(i+1));
                JSONObject m=list.get(i);list.set(i,list.get(j));list.set(j,m);
            }
        } catch(java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private void pagination(LinearLayout p,int page,int pages,java.util.function.IntConsumer go) {
        if(pages<=1)return;
        a.space(p,12); add(p,"Sayfa "+page+" / "+pages,14,a.muted);
        HorizontalScrollView scroll=new HorizontalScrollView(a); LinearLayout r=a.row(); scroll.addView(r);p.addView(scroll);
        if(page>1) action(r,"‹",()->go.accept(page-1));
        java.util.TreeSet<Integer> nums=new java.util.TreeSet<>();nums.add(1);nums.add(pages);nums.add(page);nums.add(page-1);nums.add(page+1);
        int previous=0;
        for(int n:nums) if(n>=1&&n<=pages) { if(previous>0&&n-previous>1)add(r," … ",16,a.muted);TextView b=action(r,String.valueOf(n),()->go.accept(n));if(n==page)b.setTextColor(a.accent);previous=n; }
        if(page<pages)action(r,"›",()->go.accept(page+1));
        action(p,"Sayfaya git",()->a.prompt("Sayfa (1–"+pages+")",String.valueOf(page),v->{try{int n=Integer.parseInt(v.trim());if(n>=1&&n<=pages)go.accept(n);else a.toast("Geçerli bir sayfa girin");}catch(NumberFormatException e){a.toast("Geçerli bir sayfa girin");}}));
    }
    /** Source SortBar: a wrapping row with the heading as its first item. */
    private void sortBar(LinearLayout p,Query s,String title) {
        Wrap flow=new Wrap(8);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=a.dp(20);p.addView(flow,lp);
        LinearLayout heading=a.row();heading.addView(label(s.q.isEmpty()?title:"“"+s.q+"” için sonuçlar",18,Color.WHITE,800));totalLabel=label("(…)",14,MUTED,600);LinearLayout.LayoutParams count=new LinearLayout.LayoutParams(-2,-2);count.leftMargin=a.dp(6);heading.addView(totalLabel,count);heading.setPadding(0,0,a.dp(12),0);flow.addView(heading,new ViewGroup.LayoutParams(-2,a.dp(32)));
        String[] glyphs={"sparkles","flame","sort","shuffle"};
        for(int i=0;i<SORTS.length;i++){final int index=i;flow.addView(chip(SORT_LABELS[i],glyphs[i],s.sort.equals(SORTS[i]),()->{Query n=s.reset();n.sort=SORTS[index];if(index==3)n.seed=UUID.randomUUID().toString();browse(n);}),new ViewGroup.LayoutParams(-2,a.dp(32)));}
        if(s.profile==0)flow.addView(chip("Profilsiz","unassigned",s.unassigned,()->{Query n=s.reset();n.unassigned=!n.unassigned;browse(n);}),new ViewGroup.LayoutParams(-2,a.dp(32)));
    }
    private LinearLayout chip(String title,String glyph,boolean selected,Runnable run) {
        int color=selected?INK:Color.WHITE;LinearLayout c=a.row();c.setPadding(a.dp(12),0,a.dp(12),0);c.setBackground(a.shape(selected?BRAND:PANEL,24));c.setGravity(Gravity.CENTER);c.addView(glyph(glyph,14,color));TextView t=label(title,14,color,500);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);lp.leftMargin=a.dp(6);c.addView(t,lp);c.setOnClickListener(v->run.run());c.setFocusable(true);c.setContentDescription(title);c.setSelected(selected);return c;
    }
    private final class Wrap extends ViewGroup {
        final int gap;Wrap(int spacing){super(a);gap=a.dp(spacing);}
        @Override protected void onMeasure(int widthSpec,int heightSpec){int width=MeasureSpec.getSize(widthSpec),x=0,y=0,line=0;
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);measureChild(child,widthSpec,heightSpec);if(x>0&&x+child.getMeasuredWidth()>width){x=0;y+=line+gap;line=0;}x+=child.getMeasuredWidth()+gap;line=Math.max(line,child.getMeasuredHeight());}
            setMeasuredDimension(width,resolveSize(y+line,heightSpec));}
        @Override protected void onLayout(boolean changed,int l,int t,int r,int b){int x=0,y=0,line=0;for(int i=0;i<getChildCount();i++){View c=getChildAt(i);int w=c.getMeasuredWidth(),h=c.getMeasuredHeight();if(x>0&&x+w>r-l){x=0;y+=line+gap;line=0;}c.layout(x,y,x+w,y+h);x+=w+gap;line=Math.max(line,h);}}
    }
    /** Reflows existing native cards when the activity handles a size change. */
    private final class ArchiveGrid extends ViewGroup {
        final boolean square;final int gapX,gapY;int columns;
        ArchiveGrid(boolean square,int gap,int rowGap){super(a);this.square=square;gapX=a.dp(gap);gapY=a.dp(rowGap);}
        @Override protected void onMeasure(int ws,int hs){int width=MeasureSpec.getSize(ws);int viewport=Math.round((width+body.getPaddingLeft()+body.getPaddingRight())/a.getResources().getDisplayMetrics().density);
            columns=square?(viewport>=1536?8:viewport>=1280?6:viewport>=1024?5:viewport>=768?4:viewport>=640?3:2):(viewport>=1536?5:viewport>=1280?4:viewport>=1024?3:viewport>=640?2:1);
            int cell=Math.max(1,(width-gapX*(columns-1))/columns),height=0,rowHeight=0;
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);child.measure(MeasureSpec.makeMeasureSpec(cell,MeasureSpec.EXACTLY),MeasureSpec.makeMeasureSpec(0,MeasureSpec.UNSPECIFIED));rowHeight=Math.max(rowHeight,child.getMeasuredHeight());if(i%columns==columns-1||i==getChildCount()-1){height+=rowHeight+(i>=columns?gapY:0);rowHeight=0;}}
            setMeasuredDimension(width,resolveSize(height,hs));}
        @Override protected void onLayout(boolean changed,int l,int t,int r,int b){int y=0;for(int start=0;start<getChildCount();start+=columns){int rowHeight=0;for(int j=0;j<columns&&start+j<getChildCount();j++){View child=getChildAt(start+j);int x=j*(child.getMeasuredWidth()+gapX);child.layout(x,y,x+child.getMeasuredWidth(),y+child.getMeasuredHeight());rowHeight=Math.max(rowHeight,child.getMeasuredHeight());}y+=rowHeight+gapY;}}
    }
    /** Additional Lucide outlines, used only where Ui has no matching glyph. */
    private View glyph(String name,int size,int color) {
        if(name.equals("video")||name.equals("photo")||name.equals("shuffle"))return icon(name,size,color,null,name);
        View v=new View(a){final Paint pen=new Paint(3);
            private void path(Canvas c,float... pts){android.graphics.Path p=new android.graphics.Path();p.moveTo(pts[0],pts[1]);for(int i=2;i<pts.length;i+=2)p.lineTo(pts[i],pts[i+1]);c.drawPath(p,pen);}
            @Override protected void onDraw(Canvas c){super.onDraw(c);c.save();c.scale(getWidth()/24f,getHeight()/24f);pen.setColor(color);pen.setStyle(Paint.Style.STROKE);pen.setStrokeWidth(1.7f);pen.setStrokeCap(Paint.Cap.ROUND);pen.setStrokeJoin(Paint.Join.ROUND);
                switch(name){case "clock":c.drawCircle(12,12,9,pen);path(c,12,6,12,12,16,14);break;
                case "eye":android.graphics.Path eye=new android.graphics.Path();eye.moveTo(2,12);eye.cubicTo(7,3,17,3,22,12);eye.cubicTo(17,21,7,21,2,12);c.drawPath(eye,pen);c.drawCircle(12,12,3,pen);break;
                case "sparkles":path(c,10,2,12,8,18,10,12,12,10,18,8,12,2,10,8,8,10,2);path(c,19,2,19,6);path(c,17,4,21,4);path(c,20,15,20,21);path(c,17,18,23,18);break;
                case "flame":android.graphics.Path flame=new android.graphics.Path();flame.moveTo(12,2);flame.cubicTo(5,10,17,9,14,15);flame.cubicTo(10,18,8,13,7,10);flame.cubicTo(-1,22,22,26,20,13);flame.cubicTo(19,8,14,5,12,2);c.drawPath(flame,pen);break;
                case "sort":path(c,7,21,7,3,3,7);path(c,7,3,11,7);path(c,13,10,17,10);path(c,13,15,20,15);path(c,13,20,23,20);break;
                default:c.drawCircle(10,7,4,pen);c.drawArc(3,13,17,28,180,180,false,pen);if(name.equals("unassigned")){path(c,18,10,23,15);path(c,23,10,18,15);}break;}
                c.restore();}};v.setLayoutParams(new LinearLayout.LayoutParams(a.dp(size),a.dp(size)));return v;
    }
    private void metric(LinearLayout row,String glyph,String value) {
        row.addView(glyph(glyph,12,MUTED));TextView t=label(value,12,MUTED,400);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-2);lp.setMargins(a.dp(4),0,a.dp(12),0);row.addView(t,lp);
    }
    /** Ratios use actual measured column width, also in split-screen and rotation. */
    private android.widget.FrameLayout thumbnail(LinearLayout parent,String url,float ratio,Runnable open,String description) {
        android.widget.FrameLayout frame=new android.widget.FrameLayout(a){@Override protected void onMeasure(int w,int h){int width=View.MeasureSpec.getSize(w);super.onMeasure(w,View.MeasureSpec.makeMeasureSpec(Math.round(width/ratio),View.MeasureSpec.EXACTLY));}};
        frame.setBackground(a.shape(PANEL,8));frame.setClipToOutline(true);parent.addView(frame,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout imageHost=a.column();frame.addView(imageHost,new android.widget.FrameLayout.LayoutParams(-1,-1));a.image(imageHost,url,180,open);View image=imageHost.getChildAt(0);image.setBackgroundColor(PANEL);image.setClipToOutline(false);image.setLayoutParams(new LinearLayout.LayoutParams(-1,-1));image.setContentDescription(description);return frame;
    }
    private void badge(android.widget.FrameLayout frame,String value,boolean quality) {
        TextView badge=label(value,quality?11:12,quality?INK:Color.WHITE,quality?800:600);badge.setPadding(a.dp(6),a.dp(2),a.dp(6),a.dp(2));badge.setBackground(a.shape(quality?BRAND:0xcc000000,4));
        android.widget.FrameLayout.LayoutParams lp=new android.widget.FrameLayout.LayoutParams(-2,-2,quality?Gravity.TOP|Gravity.LEFT:Gravity.BOTTOM|Gravity.RIGHT);lp.setMargins(a.dp(8),a.dp(8),a.dp(8),a.dp(8));frame.addView(badge,lp);
    }
    private void mediaGrid(LinearLayout p,List<JSONObject> list,int profile) {
        ArchiveGrid grid=new ArchiveGrid(!list.isEmpty()&&list.get(0).optString("kind").equals("IMAGE"),!list.isEmpty()&&list.get(0).optString("kind").equals("IMAGE")?12:16,24);p.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(JSONObject m:list){boolean photo=m.optString("kind").equals("IMAGE");int id=m.optInt("id");Runnable open=()->a.navigate(()->detail(id,profile,true));LinearLayout cell=a.column();
            grid.addView(cell,new ViewGroup.LayoutParams(-1,-2));
            android.widget.FrameLayout image=thumbnail(cell,api("/thumb/"+id)+version(m),photo?1:16/9f,open,m.optString("title"));
            image.setOnLongClickListener(v->{open.run();return true;});
            ((ViewGroup)image.getChildAt(0)).getChildAt(0).setOnLongClickListener(v->image.performLongClick());
            if(photo)continue;
            String quality=m.optInt("height")>=2000?"4K":m.optInt("height")>=1000?"FHD":m.optInt("height")>=700?"HD":"";
            if(!quality.isEmpty())badge(image,quality,true);if(m.optInt("duration")>0)badge(image,duration(m.optInt("duration")),false);
            TextView title=label(m.optString("title","Adsız"),14,Color.WHITE,600);title.setMaxLines(2);title.setPadding(0,a.dp(8),0,0);title.setOnClickListener(v->open.run());cell.addView(title);
            LinearLayout names=a.row();names.setPadding(0,a.dp(4),0,0);names.addView(glyph("user",12,MUTED));Wrap people=new Wrap(4);LinearLayout.LayoutParams peopleLp=new LinearLayout.LayoutParams(0,-2,1);peopleLp.leftMargin=a.dp(4);names.addView(people,peopleLp);List<JSONObject> profiles=rows(array(m,"profiles"));
            if(profiles.isEmpty())people.addView(label("Profil yok",12,MUTED,400),new ViewGroup.LayoutParams(-2,-2));
            for(JSONObject pr:profiles){TextView name=label(pr.optString("name"),12,MUTED,400);name.setOnClickListener(v->a.navigate(()->profile(pr.optInt("id"))));people.addView(name,new ViewGroup.LayoutParams(-2,-2));}
            cell.addView(names);LinearLayout stats=a.row();stats.setPadding(0,a.dp(2),0,0);metric(stats,"eye",String.valueOf(m.optInt("views")));metric(stats,"clock",age(m.optString("createdAt")));cell.addView(stats);
            title.setOnLongClickListener(v->{open.run();return true;});
        }
    }
    private void profiles(String q) {
        LinearLayout p=begin("Profiller","",3,()->profiles(q));search(q,v->profiles(v));LinearLayout result=loading(p);
        extraMenu=()->createProfile(id->a.navigate(()->profile(id)));
        a.get(api("/mobile/home"),data->{result.removeAllViews();List<JSONObject> list=rows(array(data,"profiles"));list.removeIf(v->!norm(v.optString("name")).contains(norm(q)));
            LinearLayout title=a.row();title.addView(label(q.isEmpty()?"Profiller":"“"+q+"” için sonuçlar",18,Color.WHITE,800));title.addView(label(" ("+list.size()+")",14,MUTED,600),new LinearLayout.LayoutParams(0,-2,1));title.addView(icon("plus",32,BRAND,()->createProfile(id->a.navigate(()->profile(id))),"Yeni profil oluştur"));result.addView(title);a.space(result,20);profileCards(result,list);});
    }
    private static String norm(String s){return s.trim().toLowerCase(TR);}
    private void profileCards(LinearLayout p,List<JSONObject> list) {
        if(list.isEmpty()){empty(p,"Profil bulunamadı");return;}ArchiveGrid grid=new ArchiveGrid(true,16,16);p.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(int i=0;i<list.size();i++){JSONObject pr=list.get(i);LinearLayout cell=a.column();grid.addView(cell,new ViewGroup.LayoutParams(-1,-2));
            int id=pr.optInt("id"),avatar=pr.optInt("avatarMediaId");Runnable open=()->a.navigate(()->profile(id));
            if(avatar>0)thumbnail(cell,api("/thumb/"+avatar),1,open,pr.optString("name"));
            else{android.widget.FrameLayout placeholder=new android.widget.FrameLayout(a){@Override protected void onMeasure(int w,int h){super.onMeasure(w,View.MeasureSpec.makeMeasureSpec(View.MeasureSpec.getSize(w),View.MeasureSpec.EXACTLY));}};placeholder.setBackground(a.shape(BRAND,8));TextView initials=label(initials(pr.optString("name")),36,INK,700);initials.setGravity(Gravity.CENTER);placeholder.addView(initials,new android.widget.FrameLayout.LayoutParams(-1,-1));placeholder.setOnClickListener(v->open.run());cell.addView(placeholder,new LinearLayout.LayoutParams(-1,-2));}
            TextView name=label(pr.optString("name")+(pr.optBoolean("hidden")?" · Gizli":""),14,Color.WHITE,700);name.setSingleLine(true);name.setEllipsize(android.text.TextUtils.TruncateAt.END);name.setPadding(0,a.dp(8),0,0);name.setOnClickListener(v->open.run());cell.addView(name);LinearLayout counts=a.row();counts.setPadding(0,a.dp(3),0,0);metric(counts,"video",String.valueOf(pr.optInt("videos")));metric(counts,"photo",String.valueOf(pr.optInt("photos")));cell.addView(counts);
        }
    }

    private void createProfile(java.util.function.IntConsumer done) {
        a.prompt("Yeni profil adı","",name->{if(name.trim().isEmpty()){a.toast("İsim boş olamaz");return;}
            a.get(api("/mobile/home"),data->{for(JSONObject existing:rows(array(data,"profiles")))if(existing.optString("name").equals(name.trim())){a.toast("Bu isimde bir profil zaten var. Farklı bir isim girin.");return;}
                a.request("POST",api("/profiles"),a.obj("name",name.trim()),p->{if(p.optInt("id")>0)done.accept(p.optInt("id"));else a.toast("Profil oluşturulamadı");});});});
    }
    private void chooseProfile(java.util.function.IntConsumer selected) {
        a.get(api("/mobile/home"),data->{List<JSONObject> profiles=rows(array(data,"profiles"));
            LinearLayout p=a.column();int pad=a.dp(16);p.setPadding(pad,pad,pad,pad);
            AlertDialog dialog=new AlertDialog.Builder(a).setTitle("Profil seç").setView(p).setNegativeButton("Vazgeç",null).create();
            LinearLayout found=a.column();ScrollView sc=new ScrollView(a);sc.addView(found);
            a.search(p,"Profil ara",q->{found.removeAllViews();for(JSONObject pr:profiles)if(norm(pr.optString("name")).contains(norm(q)))action(found,pr.optString("name"),()->{dialog.dismiss();selected.accept(pr.optInt("id"));});});
            p.addView(sc,new LinearLayout.LayoutParams(-1,a.dp(300)));
            for(JSONObject pr:profiles)action(found,pr.optString("name"),()->{dialog.dismiss();selected.accept(pr.optInt("id"));});
            action(p,"Yeni profil oluştur",()->{dialog.dismiss();createProfile(selected);});track(dialog);dialog.show();
        });
    }
    private void profile(int id) { profile(id,new Query("VIDEO",id)); }
    private void profile(int id,Query query) {
        LinearLayout p=begin("Profil","",3,()->profile(id,query));LinearLayout content=loading(p);
        a.get(api("/mobile/profile/"+id),data->{content.removeAllViews();JSONObject pr=data.optJSONObject("profile");if(pr==null){empty(content,"Profil bulunamadı");return;}
            String name=pr.optString("name");int avatar=pr.optInt("avatarMediaId");
            LinearLayout header=surface(content);header.setPadding(a.dp(20),a.dp(20),a.dp(20),a.dp(20));header.setBackground(a.shape(PANEL,8));
            Wrap identity=new Wrap(20);header.addView(identity,new LinearLayout.LayoutParams(-1,-2));
            LinearLayout face=a.column();identity.addView(face,new ViewGroup.LayoutParams(a.dp(112),a.dp(112)));
            if(avatar>0){android.widget.FrameLayout image=thumbnail(face,api("/thumb/"+avatar),1,()->a.photo(api("/file/"+avatar),name),name);image.setBackground(a.shape(PANEL,56));image.setClipToOutline(true);}
            else{TextView initials=label(initials(name),36,BRAND,800);initials.setGravity(Gravity.CENTER);initials.setBackground(a.shape(INK,56));face.addView(initials,new LinearLayout.LayoutParams(-1,-1));}
            LinearLayout names=a.column();names.addView(label(name,24,Color.WHITE,800));a.space(names,6);a.note(names,pr.optInt("videos")+" video · "+pr.optInt("photos")+" fotoğraf");identity.addView(names,new ViewGroup.LayoutParams(-2,-2));
            a.space(header,16);Wrap actions=new Wrap(8);header.addView(actions,new LinearLayout.LayoutParams(-1,-2));
            compact(actions,"Profil fotoğrafı yükle",()->pickAvatar(id),true);
            compact(actions,"Fotoğraf / video ekle",()->a.choose("Yüklenecek medya",new String[]{"Fotoğraflar (40 MB/dosya)","Videolar (190 MB/dosya)","Fotoğraf ve video"},n->pickMedia(id,n==0?"image/*":n==1?"video/*":"*/*")),true);
            compact(actions,pr.optBoolean("hidden")?"Gizli profil: Açık · Göster":"Gizli profil: Kapalı · Gizle",()->patchProfile(id,a.obj("hidden",!pr.optBoolean("hidden"))),false);
            compact(actions,"Adı değiştir",()->a.prompt("Profil adı",name,v->{if(v.trim().isEmpty()){a.toast("İsim boş olamaz");return;}patchProfile(id,a.obj("name",v.trim()));}),false);
            compact(actions,"Fotoğraf ayarları",()->a.choose("Profil fotoğrafı",new String[]{"Arşivden seç","Kırpmayı ayarla","Resmi sıfırla"},n->{if(n==0)avatarLibrary(id,new Query("IMAGE",0));else if(n==1&&avatar>0)crop(id,avatar,null,()->profile(id));else if(n==2)patchProfile(id,a.obj("avatarMediaId",JSONObject.NULL));}),false);
            compact(actions,"Sil",()->a.confirm("Profili sil","“"+name+"” profili silinsin mi? Medya dosyaları korunur.",()->a.request("DELETE",api("/profiles/"+id),null,r->profiles(""))),false).setTextColor(0xffff7777);
            a.space(content,20);Wrap tabs=new Wrap(4);content.addView(tabs,new LinearLayout.LayoutParams(-1,-2));
            compact(tabs,"Videolar ("+pr.optInt("videos")+")",()->profile(id,new Query("VIDEO",id)),query.kind.equals("VIDEO"));
            compact(tabs,"Fotoğraflar ("+pr.optInt("photos")+")",()->profile(id,new Query("IMAGE",id)),query.kind.equals("IMAGE"));
            a.space(content,20);activeQuery=query;sortBar(content,query,query.kind.equals("IMAGE")?"Fotoğraflar":"Videolar");
            // Profile paging/sorting stays below the profile identity and tabs.
            LinearLayout result=loading(content);
            if(query.snapshot!=null)renderLocal(result,query);
            else if(query.sort.equals("random"))collect(query,result,all->{all.sort(Comparator.comparingInt(m->m.optInt("id")));shuffle(all,query.seed);query.snapshot=all;renderLocal(result,query);});
            else a.get(listPath(query,query.page,query.sort),items->{result.removeAllViews();if(totalLabel!=null)totalLabel.setText("("+items.optInt("total")+")");List<JSONObject> list=rows(array(items,"items"));if(list.isEmpty())empty(result,"Bu profilde medya yok");else mediaGrid(result,list,id);pagination(result,query.page,Math.max(1,items.optInt("pages",1)),n->{Query next=query.copy();next.page=n;profile(id,next);});});
        });
    }
    private TextView compact(ViewGroup parent,String value,Runnable run,boolean primary){
        TextView t=label(value,14,primary?INK:Color.WHITE,600);t.setGravity(Gravity.CENTER);t.setPadding(a.dp(14),a.dp(9),a.dp(14),a.dp(9));t.setMinHeight(a.dp(36));t.setBackground(a.shape(primary?BRAND:INK,4));t.setFocusable(true);t.setOnClickListener(v->run.run());parent.addView(t,new ViewGroup.LayoutParams(-2,-2));return t;
    }
    private void previewProfile(LinearLayout p,JSONObject data,int id){List<JSONObject> list=data==null?new ArrayList<>():rows(array(data,"items"));if(list.isEmpty())a.note(p,"Bu profilde medya yok");else mediaGrid(p,list,id);}
    private void patchProfile(int id,JSONObject patch){a.request("PATCH",api("/profiles/"+id),patch,r->profile(id));}
    private static String initials(String name){StringBuilder b=new StringBuilder();for(String s:name.trim().split("\\s+")){if(!s.isEmpty())b.append(s.substring(0,1).toUpperCase(TR));if(b.length()>=2)break;}return b.length()==0?"?":b.toString();}

    private void detail(int id,int scope,boolean count) { detail(id,scope,count,false); }
    private void detail(int id,int scope,boolean count,boolean loop) {
        LinearLayout p=begin("Medya ayrıntıları","",-1,()->detail(id,scope,false,loop));LinearLayout content=loading(p);
        a.get(api("/mobile/media/"+id),data->{JSONObject m=data.optJSONObject("media");content.removeAllViews();if(m==null){empty(content,"Medya bulunamadı");return;}
            boolean photo=m.optString("kind").equals("IMAGE");selectTab(photo?2:1);
            if(scope>0&&!hasProfile(m,scope)){empty(content,"Medya bu profile ait değil");return;}
            if(count)a.request("POST",api("/media/"+id+"/view"),a.obj(),r->{});
            if(photo){TextView back=label(scope>0?"‹ Profil fotoğraflarına dön":"‹ Fotoğraflara dön",14,MUTED,400);back.setPadding(0,0,0,a.dp(12));content.addView(back);back.setOnClickListener(v->{if(scope>0)profile(scope,new Query("IMAGE",scope));else browse(new Query("IMAGE",0));});new PhotoSession(m,scope).inline(content);}
            else{
                if(scope>0){TextView back=label("‹ Profil videolarına dön",14,MUTED,400);back.setPadding(0,0,0,a.dp(12));content.addView(back);back.setOnClickListener(v->profile(scope));}
                new GalleryPlayer(m,loop,0).attach(content);
                Wrap metadata=new Wrap(8);LinearLayout.LayoutParams metaLp=new LinearLayout.LayoutParams(-1,-2);metaLp.setMargins(0,a.dp(12),0,a.dp(16));content.addView(metadata,metaLp);
                compactMetric(metadata,"eye",m.optInt("views")+" izlenme");compactMetric(metadata,"clock",age(m.optString("createdAt")));compactMetric(metadata,null,duration(m.optInt("duration")));if(m.optInt("width")>0)compactMetric(metadata,null,m.optInt("width")+"×"+m.optInt("height"));
            }
            mediaSettings(content,m,scope);
            if(!photo)recommendations(content,m,scope);
        });
    }
    private void compactMetric(ViewGroup parent,String symbol,String value){LinearLayout row=a.row();if(symbol!=null)row.addView(glyph(symbol,15,MUTED));TextView t=label(value,14,MUTED,400);t.setPadding(a.dp(6),0,a.dp(8),0);row.addView(t);parent.addView(row,new ViewGroup.LayoutParams(-2,-2));}
    private void selectTab(int tab){activeTab=tab;if(tabStrip==null)return;String[] symbols={"video","photo","users"};for(int i=0;i<tabStrip.getChildCount();i++){LinearLayout cell=(LinearLayout)tabStrip.getChildAt(i),line=(LinearLayout)cell.getChildAt(0);int color=i+1==tab?BRAND:Color.WHITE;line.removeViewAt(0);line.addView(icon(symbols[i],20,color,null,symbols[i]),0);((TextView)line.getChildAt(1)).setTextColor(color);cell.getChildAt(1).setBackgroundColor(i+1==tab?BRAND:Color.TRANSPARENT);}}
    private static boolean hasProfile(JSONObject m,int id){for(JSONObject p:rows(array(m,"profiles")))if(p.optInt("id")==id)return true;return false;}
    private void mediaSettings(LinearLayout parent,JSONObject m,int scope){
        int id=m.optInt("id");LinearLayout p=surface(parent);p.setPadding(a.dp(16),a.dp(16),a.dp(16),a.dp(16));p.setBackground(a.shape(PANEL,8));
        TextView heading=label("⚙  PROFİL VE İSİM AYARLARI",12,BRAND,800);heading.setLetterSpacing(.08f);p.addView(heading);a.space(p,12);
        Wrap title=new Wrap(8);p.addView(title,new LinearLayout.LayoutParams(-1,-2));title.addView(label(m.optString("title"),20,Color.WHITE,800),new ViewGroup.LayoutParams(-2,-2));
        compact(title,"İsmi düzenle",()->a.prompt("Başlık",m.optString("title"),v->{if(v.trim().isEmpty()){a.toast("Başlık boş olamaz");return;}a.request("PATCH",api("/media/"+id),a.obj("title",v.trim()),r->detail(id,scope,false));}),false);
        a.space(p,16);Wrap people=new Wrap(8);p.addView(people,new LinearLayout.LayoutParams(-1,-2));List<JSONObject> ps=rows(array(m,"profiles"));
        if(ps.isEmpty())people.addView(label("Henüz profil atanmadı.",14,MUTED,400),new ViewGroup.LayoutParams(-2,-2));
        for(JSONObject pr:ps){int pid=pr.optInt("id");LinearLayout pill=a.row();pill.setPadding(a.dp(4),a.dp(4),a.dp(6),a.dp(4));pill.setBackground(Ui.border(a,INK,0xff3a3a3a,24));
            TextView face=label(initials(pr.optString("name")),12,BRAND,700);face.setGravity(Gravity.CENTER);face.setBackground(a.shape(PANEL,20));pill.addView(face,new LinearLayout.LayoutParams(a.dp(28),a.dp(28)));
            TextView name=label(pr.optString("name"),14,Color.WHITE,600);name.setPadding(a.dp(8),0,a.dp(8),0);pill.addView(name);name.setOnClickListener(v->a.navigate(()->profile(pid)));
            if(m.optString("kind").equals("IMAGE")){View camera=icon("photo",28,MUTED,()->crop(pid,id,null,()->profile(pid)),"Bunu profil resmi yap");pill.addView(camera);}
            View remove=icon("close",28,MUTED,()->{JSONArray ids=new JSONArray();for(JSONObject other:ps)if(other.optInt("id")!=pid)ids.put(other.optInt("id"));a.request("PATCH",api("/media/"+id),a.obj("profileIds",ids),r->detail(id,scope==pid?0:scope,false));},"Profilden çıkar");pill.addView(remove);people.addView(pill,new ViewGroup.LayoutParams(-2,-2));
        }
        compact(people,"Profili düzenle",()->profilePicker(m,scope),true);a.space(p,16);
        Wrap files=new Wrap(8);p.addView(files,new LinearLayout.LayoutParams(-1,-2));
        compact(files,"İndir",()->a.download(api("/file/"+id),filename(m),mime(m)),false);
        compact(files,"Paylaş",()->a.share(api("/file/"+id),mime(m)),false);
        compact(files,"Dosya bilgileri",()->a.choose("Dosya bilgileri",new String[]{m.optInt("width")+" × "+m.optInt("height"),"Eklenme: "+m.optString("createdAt"),"Değiştirilme: "+m.optString("mtime"),"Dosya: "+m.optString("path"),"Kimlik: "+id},n->{}),false);
        compact(files,"Sil",()->a.confirm("Medyayı kalıcı olarak sil","“"+m.optString("title")+"” dosyası HDD’den ve tüm profillerden tamamen silinecek. Bu işlem geri alınamaz.",()->a.request("DELETE",api("/media/"+id),a.obj("confirmed",true),r->{if(scope>0)profile(scope);else browse(new Query(m.optString("kind"),0));})),false).setTextColor(0xffff7777);
    }
    private void profilePicker(JSONObject m,int scope){
        a.get(api("/mobile/home"),data->{List<JSONObject> profiles=rows(array(data,"profiles"));Set<Integer> selected=new HashSet<>();for(JSONObject p:rows(array(m,"profiles")))selected.add(p.optInt("id"));
            LinearLayout p=a.column();p.setPadding(a.dp(16),a.dp(12),a.dp(16),a.dp(12));
            AlertDialog d=new AlertDialog.Builder(a).setTitle("Profilleri düzenle").setView(p).setNegativeButton("Vazgeç",null).create();
            LinearLayout found=a.column();EditText search=new EditText(a);search.setTextColor(a.ink);search.setHintTextColor(a.muted);search.setHint("Profil ara veya yeni isim yaz");p.addView(search);
            ScrollView scroll=new ScrollView(a);scroll.addView(found);p.addView(scroll,new LinearLayout.LayoutParams(-1,a.dp(280)));
            Runnable render=()->{found.removeAllViews();String q=norm(search.getText().toString());boolean any=false;for(JSONObject pr:profiles)if(norm(pr.optString("name")).contains(q)){any=true;CheckBox cb=new CheckBox(a);cb.setText(pr.optString("name"));cb.setTextColor(a.ink);cb.setButtonTintList(android.content.res.ColorStateList.valueOf(a.accent));cb.setMinHeight(a.dp(48));int id=pr.optInt("id");cb.setChecked(selected.contains(id));cb.setOnCheckedChangeListener((v,on)->{if(on)selected.add(id);else selected.remove(id);});found.addView(cb);}if(!any)a.note(found,"Profil bulunamadı; yeni profil oluşturabilirsiniz.");};
            search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int st,int c,int af){}public void onTextChanged(CharSequence s,int st,int before,int count){render.run();}public void afterTextChanged(android.text.Editable e){}});
            action(p,"Yazılan isimle profil oluştur ve seç",()->{String name=search.getText().toString().trim();if(name.isEmpty()){a.toast("İsim girin");return;}a.request("POST",api("/profiles"),a.obj("name",name),pr->{int id=pr.optInt("id");if(id<=0){a.toast("Profil oluşturulamadı");return;}boolean exists=false;for(JSONObject row:profiles)if(row.optInt("id")==id)exists=true;if(!exists)profiles.add(pr);selected.add(id);search.setText("");render.run();});});
            action(p,"Seçilen profilleri kaydet",()->{JSONArray ids=new JSONArray();for(int id:selected)ids.put(id);a.request("PATCH",api("/media/"+m.optInt("id")),a.obj("profileIds",ids),r->{d.dismiss();detail(m.optInt("id"),scope>0&&!selected.contains(scope)?0:scope,false);});});
            render.run();track(d);d.show();
        });
    }
    private void recommendations(LinearLayout p,JSONObject media,int scope){a.heading(p,scope>0?"Bu profildeki diğer videolar":"Önerilen videolar");LinearLayout result=loading(p);Query s=new Query("VIDEO",scope);
        collect(s,result,all->{result.removeAllViews();all.removeIf(m->m.optInt("id")==media.optInt("id"));shuffle(all,UUID.randomUUID().toString());List<JSONObject> chosen=new ArrayList<>();
            if(scope==0)for(JSONObject row:all){boolean same=false;for(JSONObject pr:rows(array(media,"profiles")))if(hasProfile(row,pr.optInt("id")))same=true;if(same&&chosen.size()<4)chosen.add(row);}
            for(JSONObject row:all)if(chosen.size()<8&&!chosen.contains(row))chosen.add(row);shuffle(chosen,UUID.randomUUID().toString());
            if(chosen.isEmpty())a.note(result,"Başka video yok");else mediaGrid(result,chosen,scope);
        });
    }
private void neighbors(int id,int scope,LinearLayout status,Consumer<JSONObject[]> done){collect(new Query("IMAGE",scope),status,all->{JSONObject newer=null,older=null;for(JSONObject m:all){int mid=m.optInt("id");if(mid>id&&(newer==null||mid<newer.optInt("id")))newer=m;if(mid<id&&(older==null||mid>older.optInt("id")))older=m;}/* Website order: previous=newer, next=older. */done.accept(new JSONObject[]{newer,older});});}
    private void rotate(JSONObject m,Runnable done){a.confirm("Fotoğrafı döndür ve kaydet","Fotoğraf 90° sağa döndürülerek orijinal dosyaya kaydedilecek.",()->a.request("POST",api("/media/"+m.optInt("id")+"/rotate"),a.obj(),r->{a.toast("Orijinal dosya kaydedildi");done.run();}));}
    private static String version(JSONObject m){return "?v="+m.optString("mtime",m.optString("createdAt","1")).replace(":","%3A");}
    private static String duration(int n){return n>=3600?String.format(Locale.ROOT,"%d:%02d:%02d",n/3600,n/60%60,n%60):String.format(Locale.ROOT,"%d:%02d",Math.max(0,n)/60,Math.max(0,n)%60);}
    private static String age(String date){try{long seconds=Math.max(0,(System.currentTimeMillis()-java.time.Instant.parse(date).toEpochMilli())/1000);long[] units={31536000,2592000,604800,86400,3600,60};String[] labels={"yıl","ay","hafta","gün","saat","dakika"};for(int i=0;i<units.length;i++)if(seconds>=units[i])return seconds/units[i]+" "+labels[i]+" önce";}catch(Exception ignored){}return "az önce";}
    private static String filename(JSONObject m){String path=m.optString("path");int slash=Math.max(path.lastIndexOf('/'),path.lastIndexOf('\\'));String file=path.substring(slash+1);return file.isEmpty()?"medya-"+m.optInt("id"):file;}
    private static String mime(JSONObject m){String f=filename(m).toLowerCase(Locale.ROOT);if(f.endsWith(".jpg")||f.endsWith(".jpeg"))return "image/jpeg";if(f.endsWith(".png"))return "image/png";if(f.endsWith(".gif"))return "image/gif";if(f.endsWith(".webp"))return "image/webp";if(f.endsWith(".avif"))return "image/avif";if(f.endsWith(".webm"))return "video/webm";if(f.endsWith(".mkv"))return "video/x-matroska";if(f.endsWith(".mov"))return "video/quicktime";if(f.endsWith(".avi"))return "video/x-msvideo";return m.optString("kind").equals("VIDEO")?"video/mp4":"image/*";}

    // Dialogs are bound to the owning page, including work dispatched outside MainActivity.
    private void watchPage(View page){int token=revision;page.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){}public void onViewDetachedFromWindow(View v){if(revision==token)revision++;}});}
    private void track(Dialog d){LinearLayout owner=body;View.OnAttachStateChangeListener listener=new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){}public void onViewDetachedFromWindow(View v){d.dismiss();}};owner.addOnAttachStateChangeListener(listener);d.setOnDismissListener(v->owner.removeOnAttachStateChangeListener(listener));d.setOnShowListener(v->{Window w=d.getWindow();if(w!=null)w.setBackgroundDrawable(a.shape(0xff292929,12));if(d instanceof AlertDialog)for(int which:new int[]{-1,-2,-3}){android.widget.Button b=((AlertDialog)d).getButton(which);if(b!=null)b.setTextColor(0xffffa31a);}});}
    private boolean alive(int token){return token==revision&&!a.isFinishing()&&!a.isDestroyed()&&body!=null&&body.isAttachedToWindow();}
    private void photoViewer(JSONObject m,int scope){new PhotoSession(m,scope).show();}

    /** Platform lifecycle bridge for the module-owned player. No host changes. */
    public static final class PlaybackLifecycle extends Fragment {
        Runnable pause, stop, configuration;
        Consumer<Boolean> pip;
        @Override public void onPause(){super.onPause();if(pause!=null)pause.run();}
        @Override public void onStop(){super.onStop();if(pause!=null)pause.run();}
        @Override public void onDestroy(){if(stop!=null)stop.run();super.onDestroy();}
        @Override public void onConfigurationChanged(android.content.res.Configuration config){super.onConfigurationChanged(config);if(configuration!=null)configuration.run();}
        @Override public void onPictureInPictureModeChanged(boolean mode,android.content.res.Configuration config){super.onPictureInPictureModeChanged(mode,config);if(pip!=null)pip.accept(mode);}
    }
    /** Small, density-independent Lucide-style native media controls. */
    private final class MediaIcon extends View {
        String symbol;int tint;final int size;final Paint pen=new Paint(3);
        MediaIcon(String symbol,int color,int size){super(a);this.symbol=symbol;this.tint=color;this.size=size;setFocusable(true);}
        void path(Canvas c,float... points){android.graphics.Path p=new android.graphics.Path();p.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)p.lineTo(points[i],points[i+1]);c.drawPath(p,pen);}
        @Override protected void onDraw(Canvas c){super.onDraw(c);int save=c.save();float side=a.dp(size);c.translate((getWidth()-side)/2,(getHeight()-side)/2);c.scale(side/24,side/24);pen.setColor(tint);pen.setStrokeWidth(1.8f);pen.setStrokeCap(Paint.Cap.ROUND);pen.setStrokeJoin(Paint.Join.ROUND);pen.setStyle(Paint.Style.STROKE);
            switch(symbol){
                case "play":pen.setStyle(Paint.Style.FILL);path(c,7,3,21,12,7,21,7,3);break;
                case "pause":pen.setStyle(Paint.Style.FILL);c.drawRoundRect(5,3,9,21,1,1,pen);c.drawRoundRect(15,3,19,21,1,1,pen);break;
                case "volume":case "muted":path(c,11,4,6,8,2,8,2,16,6,16,11,20,11,4);if(symbol.equals("muted")){path(c,16,9,22,15);path(c,22,9,16,15);}else{c.drawArc(7,2,23,22,-55,110,false,pen);c.drawArc(10,6,20,18,-55,110,false,pen);}break;
                case "rewind":case "forward":if(symbol.equals("rewind")){c.translate(24,0);c.scale(-1,1);}c.drawArc(4,4,20,20,55,290,false,pen);path(c,16,2,20,6,15,7);break;
                case "loop":path(c,4,7,19,7,16,4);path(c,19,7,16,10);path(c,20,17,5,17,8,20);path(c,5,17,8,14);path(c,4,7,4,12);path(c,20,17,20,12);break;
                case "pip":c.drawRoundRect(2,4,22,20,2,2,pen);c.drawRect(12,11,20,18,pen);break;
                case "keyboard":c.drawRoundRect(2,5,22,19,2,2,pen);for(int y=9;y<15;y+=4)for(int x=6;x<20;x+=4)c.drawPoint(x,y,pen);path(c,7,16,17,16);break;
                case "minimize":path(c,3,8,8,8,8,3);path(c,16,3,16,8,21,8);path(c,21,16,16,16,16,21);path(c,8,21,8,16,3,16);break;
                case "fullscreen":path(c,8,3,3,3,3,8);path(c,16,3,21,3,21,8);path(c,21,16,21,21,16,21);path(c,8,21,3,21,3,16);break;
                case "left":path(c,15,6,9,12,15,18);break;
                case "right":path(c,9,6,15,12,9,18);break;
                case "minus":case "plus":c.drawCircle(10,10,6,pen);path(c,14.5f,14.5f,21,21);path(c,7,10,13,10);if(symbol.equals("plus"))path(c,10,7,10,13);break;
                case "rotate":c.drawArc(4,4,20,20,45,290,false,pen);path(c,16,2,20,6,15,7);break;
                case "close":path(c,6,6,18,18);path(c,18,6,6,18);break;
            }c.restoreToCount(save);
        }
    }
    private final class GalleryPlayer {
        final JSONObject mediaInfo;final String title;final int start;
        final Handler handler=new Handler(Looper.getMainLooper());
        final SharedPreferences prefs=a.getSharedPreferences("gallery-player",android.content.Context.MODE_PRIVATE);
        boolean loop,ready,disposed,dragging,holding,fullscreen,controlsShown=true,muted;
        float rate,volume;MediaPlayer player;StreamVideoView video;PlaybackLifecycle lifecycle;
        LinearLayout page,overlay;android.widget.FrameLayout frame,host;Dialog fullscreenDialog;
        TextView status,clock,rateButton;SeekBar seek,volumeBar;
        MediaIcon playIcon,loopIcon,muteIcon,centerIcon,fullIcon;
        final List<View> wideControls=new ArrayList<>();
        int savedPosition,openGeneration;boolean resumePlaying=true,pipActive,preparing,restoring,reopenPending;
        long loadStarted,seekStarted;
        final List<View> pipHidden=new ArrayList<>();final List<Integer> pipVisibility=new ArrayList<>();
        GalleryPlayer(JSONObject info,boolean repeat,int seconds){mediaInfo=info;title=info.optString("title");loop=repeat;start=seconds;savedPosition=seconds*1000;rate=clamp(prefs.getFloat("speed",1),.5f,2);volume=clamp(prefs.getFloat("volume",1),0,1);muted=prefs.getBoolean("muted",false);}
        void attach(LinearLayout parent){
            page=body;
            host=new android.widget.FrameLayout(a){
                @Override protected void onMeasure(int ws,int hs){int w=MeasureSpec.getSize(ws);int cap=Math.round(a.getResources().getDisplayMetrics().heightPixels*.78f);super.onMeasure(ws,MeasureSpec.makeMeasureSpec(Math.min(Math.round(w*9/16f),cap),MeasureSpec.EXACTLY));}
            };
            host.setBackground(a.shape(Color.BLACK,8));host.setClipToOutline(true);parent.addView(host,new LinearLayout.LayoutParams(-1,-2));
            frame=new android.widget.FrameLayout(a);frame.setBackgroundColor(Color.BLACK);host.addView(frame,new android.widget.FrameLayout.LayoutParams(-1,-1));
            // The video surface consumes gestures; the controls are real native buttons above it.
            View touch=new View(a);frame.addView(touch,new android.widget.FrameLayout.LayoutParams(-1,-1));
            overlay=a.column();overlay.setPadding(a.dp(12),a.dp(48),a.dp(12),a.dp(8));
            overlay.setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x00000000,0x80000000,0xe6000000}));
            frame.addView(overlay,new android.widget.FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
            seek=new SeekBar(a){
                final Paint pen=new Paint(3);
                @Override protected void onDraw(Canvas c){float left=getPaddingLeft(),right=getWidth()-getPaddingRight(),y=getHeight()/2f;pen.setStrokeCap(Paint.Cap.ROUND);pen.setStrokeWidth(a.dp(4));pen.setColor(0x40ffffff);c.drawLine(left,y,right,y,pen);pen.setColor(0x60ffffff);c.drawLine(left,y,left+(right-left)*getSecondaryProgress()/getMax(),y,pen);pen.setColor(BRAND);float x=left+(right-left)*getProgress()/getMax();c.drawLine(left,y,x,y,pen);if(dragging||isFocused())c.drawCircle(x,y,a.dp(7),pen);}
            };
            seek.setPadding(a.dp(7),0,a.dp(7),0);seek.setMax(10000);seek.setContentDescription("Video ilerlemesi");overlay.addView(seek,new LinearLayout.LayoutParams(-1,a.dp(20)));
            seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){dragging=true;wake();s.getParent().requestDisallowInterceptTouchEvent(true);}public void onStopTrackingTouch(SeekBar s){if(ready)video.seekTo((int)((long)video.getDuration()*s.getProgress()/10000));dragging=false;s.getParent().requestDisallowInterceptTouchEvent(false);wake();}public void onProgressChanged(SeekBar s,int value,boolean user){if(user&&ready)clock.setText(duration((int)((long)video.getDuration()*value/10000/1000))+" / "+duration(video.getDuration()/1000));}});
            LinearLayout buttons=a.row();overlay.addView(buttons,new LinearLayout.LayoutParams(-1,a.dp(40)));
            playIcon=control(buttons,"play","Oynat / duraklat (K)",this::toggle);
            wideControls.add(control(buttons,"rewind","10 saniye geri (J)",()->seekBy(-10000)));
            wideControls.add(control(buttons,"forward","10 saniye ileri (L)",()->seekBy(10000)));
            muteIcon=control(buttons,"volume","Sessiz (M)",this::toggleMute);
            volumeBar=new SeekBar(a);volumeBar.setMax(100);volumeBar.setProgress(muted?0:Math.round(volume*100));volumeBar.setContentDescription("Ses seviyesi");tint(volumeBar);buttons.addView(volumeBar,new LinearLayout.LayoutParams(a.dp(64),a.dp(32)));wideControls.add(volumeBar);
            volumeBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){wake();}public void onStopTrackingTouch(SeekBar s){wake();}public void onProgressChanged(SeekBar s,int value,boolean user){if(user)setVolume(value/100f);}});
            clock=label("0:00 / 0:00",12,Color.WHITE,500);clock.setSingleLine(true);clock.setGravity(Gravity.CENTER_VERTICAL);clock.setPadding(a.dp(4),0,0,0);buttons.addView(clock,new LinearLayout.LayoutParams(0,-1,1));
            rateButton=label(speedText(rate),12,Color.WHITE,700);rateButton.setGravity(Gravity.CENTER);rateButton.setContentDescription("Oynatma hızı; basılı tut: oynatma seçenekleri");rateButton.setFocusable(true);rateButton.setOnClickListener(v->speedMenu());rateButton.setOnLongClickListener(v->{options();return true;});buttons.addView(rateButton,new LinearLayout.LayoutParams(a.dp(40),-1));
            loopIcon=control(buttons,"loop","Döngü (R)",this::toggleLoop);wideControls.add(loopIcon);
            wideControls.add(control(buttons,"keyboard","Klavye kısayolları (?)",this::help));
            wideControls.add(control(buttons,"pip","Küçük pencere (P)",this::pip));
            fullIcon=control(buttons,"fullscreen","Tam ekran (F)",()->setFullscreen(!fullscreen));
            centerIcon=new MediaIcon("play",INK,34);centerIcon.setBackground(a.shape(BRAND,100));centerIcon.setContentDescription("Ortadan oynat / duraklat");centerIcon.setOnClickListener(v->toggle());frame.addView(centerIcon,new android.widget.FrameLayout.LayoutParams(a.dp(56),a.dp(56),Gravity.CENTER));
            status=label("Video hazırlanıyor…",13,Color.WHITE,600);status.setGravity(Gravity.CENTER);status.setPadding(a.dp(12),a.dp(6),a.dp(12),a.dp(6));status.setBackground(a.shape(0xbf000000,24));status.setContentDescription("Oynatma durumu");android.widget.FrameLayout.LayoutParams sp=new android.widget.FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.CENTER_HORIZONTAL);sp.topMargin=a.dp(16);frame.addView(status,sp);
            status.setOnClickListener(v->{if(!ready)load();});
            frame.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{boolean wide=(r-l)/a.getResources().getDisplayMetrics().density>=640;for(View control:wideControls)control.setVisibility(wide?View.VISIBLE:View.GONE);int size=a.dp(wide?80:56);if(centerIcon.getLayoutParams().width!=size){centerIcon.getLayoutParams().width=size;centerIcon.getLayoutParams().height=size;centerIcon.requestLayout();}});
            GestureDetector gestures=new GestureDetector(a,new GestureDetector.SimpleOnGestureListener(){
                public boolean onDown(MotionEvent e){return true;}
                public boolean onSingleTapConfirmed(MotionEvent e){if(!holding){setControls(!controlsShown);if(controlsShown)wakeTimer();}return true;}
                public boolean onDoubleTap(MotionEvent e){seekBy(e.getX()<frame.getWidth()/2?-10000:10000);return true;}
                public void onLongPress(MotionEvent e){if(ready&&video.isPlaying()){holding=true;applyRate(2,false);flash("Geçici 2× hız");}}
            });
            touch.setOnTouchListener((v,e)->{gestures.onTouchEvent(e);if(e.getActionMasked()==MotionEvent.ACTION_DOWN){v.getParent().requestDisallowInterceptTouchEvent(true);frame.requestFocus();}if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL){if(holding){holding=false;applyRate(rate,false);}v.getParent().requestDisallowInterceptTouchEvent(false);wakeTimer();}return true;});
            View.OnKeyListener keys=(v,key,event)->{if(event.getAction()!=KeyEvent.ACTION_DOWN||event.isCtrlPressed()||event.isAltPressed()||event.isMetaPressed())return false;return key(key,event);};
            frame.setFocusableInTouchMode(true);frame.setOnKeyListener(keys);frame.requestFocus();
            frame.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){scheduleOpen();}public void onViewDetachedFromWindow(View v){}});
            lifecycle=new PlaybackLifecycle();lifecycle.pause=()->{if(!a.isInPictureInPictureMode())pause();};lifecycle.stop=this::dispose;lifecycle.pip=this::pipChanged;lifecycle.configuration=()->{host.requestLayout();frame.requestLayout();};
            a.getFragmentManager().beginTransaction().add(lifecycle,"gallery-playback-"+UUID.randomUUID()).commit();
            a.onPageCleanup(this::dispose);handler.post(tick);load();
        }
        String speedText(float speed){return (speed==(int)speed?String.valueOf((int)speed):String.valueOf(speed))+"×";}
        MediaIcon control(LinearLayout row,String symbol,String description,Runnable click){MediaIcon v=new MediaIcon(symbol,Color.WHITE,21);v.setContentDescription(description);v.setFocusable(true);v.setOnClickListener(w->{click.run();wake();});row.addView(v,new LinearLayout.LayoutParams(a.dp(40),a.dp(40)));return v;}
        void options(){a.choose("Oynatma seçenekleri",new String[]{loop?"Döngüyü kapat":"Döngüyü aç","Küçük pencere (PiP)","Klavye / Dokunma yardımı","Yeniden dene"},n->{if(n==0)toggleLoop();if(n==1)pip();if(n==2)help();if(n==3)load();});}
        void tint(SeekBar bar){bar.setProgressTintList(android.content.res.ColorStateList.valueOf(0xffffa31a));bar.setThumbTintList(android.content.res.ColorStateList.valueOf(0xffffa31a));}
        int position(){try{return ready?video.getCurrentPosition():savedPosition;}catch(Exception e){return savedPosition;}}
        void releaseVideo(){player=null;if(video==null)return;StreamVideoView previous=video;video=null;previous.setOnPreparedListener(null);previous.setOnInfoListener(null);previous.setOnCompletionListener(null);previous.setOnErrorListener(null);previous.stopPlayback();if(previous.getParent() instanceof ViewGroup)((ViewGroup)previous.getParent()).removeView(previous);}
        void prepareOpen(){ready=false;preparing=true;restoring=false;reopenPending=true;openGeneration++;holding=false;handler.removeCallbacks(hide);handler.removeCallbacks(hideStatus);releaseVideo();status.setText("Video hazırlanıyor…");status.setVisibility(View.VISIBLE);screenAwake(false);if(!pipActive)setControls(true);}
        void load(){if(disposed)return;if(ready)rememberPlayback();prepareOpen();scheduleOpen();}
        void scheduleOpen(){if(disposed||!reopenPending||!frame.isAttachedToWindow())return;int generation=++openGeneration;frame.post(()->{if(disposed||generation!=openGeneration||!reopenPending||!frame.isAttachedToWindow())return;reopenPending=false;openVideo(generation);});}
        void openVideo(int generation){
            // Bounded byte-range reads avoid downloading through the file to find
            // MP4 metadata or a seek target. Window transfers keep this instance.
            loadStarted=android.os.SystemClock.elapsedRealtime();
            StreamVideoView current=new StreamVideoView(a);video=current;frame.addView(current,0,new android.widget.FrameLayout.LayoutParams(-1,-1,Gravity.CENTER));
            current.setOnKeyListener((v,key,event)->event.getAction()==KeyEvent.ACTION_DOWN&&!event.isCtrlPressed()&&!event.isAltPressed()&&!event.isMetaPressed()&&key(key,event));
            current.setOnPreparedListener(mp->{if(disposed||generation!=openGeneration||video!=current)return;player=mp;mp.setLooping(loop);mp.setVolume(0,0);current.pause();
                mp.setOnBufferingUpdateListener((m,percent)->{if(!disposed&&player==m)seek.setSecondaryProgress(percent*100);});
                int target=Math.max(0,Math.min(savedPosition,Math.max(0,mp.getDuration()-1)));clock.setText(duration(target/1000)+" / "+duration(mp.getDuration()/1000));
                mp.setOnSeekCompleteListener(m->{if(disposed||generation!=openGeneration||video!=current||player!=m)return;if(restoring)finishOpen();else if(seekStarted>0){android.util.Log.i("KeremhubGalleryPlayer","Seek completed in "+(android.os.SystemClock.elapsedRealtime()-seekStarted)+" ms");seekStarted=0;}});
                // Fresh playback starts immediately; only retries at a saved
                // position need an initial seek. Use a nearby keyframe for speed.
                if(target>0||!resumePlaying){restoring=true;status.setText("Görüntü hazırlanıyor…");mp.seekTo((long)target,MediaPlayer.SEEK_CLOSEST_SYNC);}else finishOpen();
            });
            current.setOnCompletionListener(mp->{if(disposed||video!=current||generation!=openGeneration)return;resumePlaying=false;updatePlay();wake();});
            current.setOnInfoListener((mp,what,extra)->{if(disposed||video!=current||generation!=openGeneration)return false;if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)android.util.Log.i("KeremhubGalleryPlayer","First frame in "+(android.os.SystemClock.elapsedRealtime()-loadStarted)+" ms");if(what==MediaPlayer.MEDIA_INFO_BUFFERING_START){status.setText("Video yükleniyor…");status.setVisibility(View.VISIBLE);}if(!preparing&&(what==MediaPlayer.MEDIA_INFO_BUFFERING_END||what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START))status.setVisibility(View.GONE);return false;});
            current.setOnErrorListener((mp,what,extra)->{if(disposed||video!=current||generation!=openGeneration)return true;ready=false;preparing=false;restoring=false;setControls(true);status.setVisibility(View.VISIBLE);status.setText("Video açılamadı ("+what+" / "+extra+"). Yeniden denemek için dokunun.");screenAwake(false);return true;});
            current.setVideoURI(Uri.parse(a.base().replaceAll("/+$","")+api("/file/"+mediaInfo.optInt("id"))));
        }
        void finishOpen(){restoring=false;preparing=false;ready=true;savedPosition=player.getCurrentPosition();applyRate(rate,false);applyVolume();if(resumePlaying)video.start();else video.pause();status.setVisibility(View.GONE);android.util.Log.i("KeremhubGalleryPlayer","Prepared in "+(android.os.SystemClock.elapsedRealtime()-loadStarted)+" ms");updatePlay();wake();}
        void toggle(){if(!ready){resumePlaying=!resumePlaying;if(!preparing)load();wake();return;}if(video.isPlaying())pause();else{if(position()>=video.getDuration()-500)video.seekTo(0);video.start();resumePlaying=true;applyRate(rate,false);updatePlay();}wake();}
        void pause(){if(disposed)return;resumePlaying=false;if(!ready)return;if(holding){holding=false;applyRate(rate,false);}video.pause();updatePlay();wake();}
        void screenAwake(boolean playing){if(playing)a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);if(fullscreenDialog!=null&&fullscreenDialog.getWindow()!=null){if(playing)fullscreenDialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else fullscreenDialog.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}}
        void updatePlay(){if(!ready)return;boolean playing=video.isPlaying();playIcon.symbol=playing?"pause":"play";centerIcon.symbol=playing?"pause":"play";playIcon.invalidate();centerIcon.invalidate();centerIcon.setContentDescription(playing?"Ortadan duraklat":"Ortadan oynat");screenAwake(playing);}
        void seekBy(int milliseconds){if(ready){seekStarted=android.os.SystemClock.elapsedRealtime();video.seekTo(Math.max(0,Math.min(video.getDuration(),position()+milliseconds)));flash((milliseconds>0?"+":"")+milliseconds/1000+" sn");wake();}}
        void ratio(double ratio){if(ready){seekStarted=android.os.SystemClock.elapsedRealtime();video.seekTo((int)(video.getDuration()*ratio));}wake();}
        void toggleLoop(){loop=!loop;if(player!=null&&ready)player.setLooping(loop);loopIcon.tint=loop?BRAND:Color.WHITE;loopIcon.invalidate();flash(loop?"Döngü açık":"Döngü kapalı");}
        void speedMenu(){a.choose("Oynatma hızı · basılı tut: diğer seçenekler",new String[]{"0.5×","0.75×","1×","1.25×","1.5×","2×"},i->applyRate(new float[]{.5f,.75f,1,1.25f,1.5f,2}[i],true));}
        void applyRate(float value,boolean persist){if(!ready||player==null)return;try{boolean playing=video.isPlaying();player.setPlaybackParams(player.getPlaybackParams().setSpeed(value));if(!playing)video.pause();if(persist){rate=value;prefs.edit().putFloat("speed",rate).apply();}rateButton.setText(speedText(value));}catch(Exception e){a.toast("Bu dosyada seçilen hız desteklenmiyor");}}
        void applyVolume(){if(player!=null&&ready){float v=muted?0:volume;player.setVolume(v,v);}muteIcon.symbol=muted||volume==0?"muted":"volume";muteIcon.invalidate();}
        void toggleMute(){muted=!muted;if(!muted&&volume==0)volume=.5f;saveVolume();}
        void setVolume(float value){volume=clamp(value,0,1);muted=volume==0;saveVolume();}
        void saveVolume(){applyVolume();volumeBar.setProgress(muted?0:Math.round(volume*100));prefs.edit().putFloat("volume",volume).putBoolean("muted",muted).apply();}
        void setControls(boolean shown){controlsShown=shown;overlay.setVisibility(shown?View.VISIBLE:View.GONE);centerIcon.setVisibility(shown?View.VISIBLE:View.GONE);}
        void wake(){if(pipActive)return;setControls(true);wakeTimer();}
        final Runnable hide=()->{if(!disposed&&ready&&video.isPlaying()&&!dragging&&!holding)setControls(false);};
        void wakeTimer(){handler.removeCallbacks(hide);handler.postDelayed(hide,4000);}
        void flash(String text){status.setText(text);status.setVisibility(View.VISIBLE);handler.removeCallbacks(hideStatus);handler.postDelayed(hideStatus,1800);}
        final Runnable hideStatus=()->{if(!disposed&&ready)status.setVisibility(View.GONE);};
        final Runnable tick=new Runnable(){public void run(){if(disposed)return;if(ready){int pos=position(),dur=video.getDuration();if(!dragging){seek.setProgress(dur>0?(int)((long)pos*10000/dur):0);clock.setText(duration(pos/1000)+" / "+duration(dur/1000));}updatePlay();}handler.postDelayed(this,400);}};
        void rememberPlayback(){if(ready){savedPosition=position();resumePlaying=video.isPlaying();}ready=false;}
        void transfer(ViewGroup target,ViewGroup.LayoutParams params){if(frame.getParent() instanceof ViewGroup)((ViewGroup)frame.getParent()).removeView(frame);target.addView(frame,params);frame.requestFocus();scheduleOpen();}
        void pip(){if(!ready)return;setFullscreen(false);try{int w=mediaInfo.optInt("width",16),h=mediaInfo.optInt("height",9);float ratio=w>0&&h>0?w/(float)h:16/9f;ratio=clamp(ratio,1/2.39f,2.39f);a.enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(Math.round(ratio*1000),1000)).build());}catch(Exception e){a.toast("Bu cihaz küçük pencereyi desteklemiyor");}}
        void pipChanged(boolean pip){if(disposed)return;pipActive=pip;if(pip){setControls(false);status.setVisibility(View.GONE);for(int i=0;i<a.root.getChildCount();i++){View child=a.root.getChildAt(i);pipHidden.add(child);pipVisibility.add(child.getVisibility());child.setVisibility(View.GONE);}transfer(a.root,new LinearLayout.LayoutParams(-1,0,1));}else{transfer(host,new android.widget.FrameLayout.LayoutParams(-1,-1));for(int i=0;i<pipHidden.size();i++)pipHidden.get(i).setVisibility(pipVisibility.get(i));pipHidden.clear();pipVisibility.clear();wake();}}
        void setFullscreen(boolean value){
            if(disposed||value==fullscreen)return;
            if(!value){if(fullscreenDialog!=null)fullscreenDialog.dismiss();return;}
            fullscreen=true;
            // Only the display surface moves. Keep the decoder, stream cache,
            // position and paused/playing state alive across both windows.
            fullscreenDialog=new Dialog(a,android.R.style.Theme_Material_NoActionBar_Fullscreen);
            android.widget.FrameLayout root=new android.widget.FrameLayout(a);root.setBackgroundColor(Color.BLACK);
            transfer(root,new android.widget.FrameLayout.LayoutParams(-1,-1));fullscreenDialog.setContentView(root);
            fullscreenDialog.setOnKeyListener((dialog,key,event)->event.getAction()==KeyEvent.ACTION_DOWN&&!event.isCtrlPressed()&&!event.isAltPressed()&&!event.isMetaPressed()&&key(key,event));
            fullscreenDialog.setOnDismissListener(dialog->{fullscreen=false;fullscreenDialog=null;if(!disposed){transfer(host,new android.widget.FrameLayout.LayoutParams(-1,-1));fullIcon.symbol="fullscreen";fullIcon.setContentDescription("Tam ekran (F)");fullIcon.invalidate();wake();}});
            fullscreenDialog.show();Window w=fullscreenDialog.getWindow();if(w!=null){w.setLayout(-1,-1);w.setBackgroundDrawableResource(android.R.color.black);w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}
            fullIcon.symbol="minimize";fullIcon.setContentDescription("Tam ekrandan çık (F)");fullIcon.invalidate();wake();
        }
        boolean key(int key,KeyEvent event){char c=(char)event.getUnicodeChar();if(c=='?'){help();return true;}if(c=='<'||c=='>'){float[] rates={.5f,.75f,1,1.25f,1.5f,2};int i=2;for(int n=0;n<rates.length;n++)if(rates[n]==rate)i=n;applyRate(rates[Math.max(0,Math.min(5,i+(c=='>'?1:-1)))],true);return true;}if(key>=KeyEvent.KEYCODE_0&&key<=KeyEvent.KEYCODE_9){ratio((key-KeyEvent.KEYCODE_0)/10.0);return true;}switch(key){case KeyEvent.KEYCODE_SPACE:case KeyEvent.KEYCODE_K:case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:toggle();break;case KeyEvent.KEYCODE_DPAD_LEFT:seekBy(-5000);break;case KeyEvent.KEYCODE_DPAD_RIGHT:seekBy(5000);break;case KeyEvent.KEYCODE_J:seekBy(-10000);break;case KeyEvent.KEYCODE_L:seekBy(10000);break;case KeyEvent.KEYCODE_DPAD_UP:setVolume(volume+.05f);break;case KeyEvent.KEYCODE_DPAD_DOWN:setVolume(volume-.05f);break;case KeyEvent.KEYCODE_M:toggleMute();break;case KeyEvent.KEYCODE_R:toggleLoop();break;case KeyEvent.KEYCODE_P:pip();break;case KeyEvent.KEYCODE_F:setFullscreen(!fullscreen);break;case KeyEvent.KEYCODE_MOVE_HOME:ratio(0);break;case KeyEvent.KEYCODE_MOVE_END:ratio(.999);break;case KeyEvent.KEYCODE_ESCAPE:if(fullscreen)setFullscreen(false);else return false;break;default:return false;}wake();return true;}
        void help(){new AlertDialog.Builder(a).setTitle("Oynatma kısayolları").setMessage("Boşluk / K: oynat, duraklat\n← / →: 5 sn geri, ileri\nJ / L: 10 sn geri, ileri\n↑ / ↓: ses\nM: sessiz\nR: döngü\n< / >: hız\n0–9: videonun %0–90’ına git\nHome / End: başa, sona\nP: küçük pencere (PiP)\nF: tam ekran\n?: yardım\nÇift dokun: sol −10 sn, sağ +10 sn\nBasılı tut: geçici 2× hız").setPositiveButton("Kapat",null).show();}
        void dispose(){if(disposed)return;disposed=true;handler.removeCallbacksAndMessages(null);if(fullscreenDialog!=null)fullscreenDialog.dismiss();ready=false;if(video!=null)video.stopPlayback();player=null;screenAwake(false);if(lifecycle!=null){lifecycle.pause=null;lifecycle.stop=null;lifecycle.pip=null;lifecycle.configuration=null;if(lifecycle.getFragmentManager()!=null)lifecycle.getFragmentManager().beginTransaction().remove(lifecycle).commitAllowingStateLoss();}}
    }

    private final class PhotoSession {
        final int scope,token=revision;final ZoomImage image=new ZoomImage(false);
        JSONObject current;JSONObject[] adjacent={null,null};int loadId,initialId;boolean disposed,fullscreen;
        android.widget.FrameLayout root,host;Dialog dialog;TextView status,zoom;MediaIcon prev,next,full;Handler ui=new Handler(Looper.getMainLooper());
        PhotoSession(JSONObject media,int profile){current=media;scope=profile;initialId=media.optInt("id");}
        void inline(LinearLayout parent){
            host=new android.widget.FrameLayout(a){@Override protected void onMeasure(int ws,int hs){super.onMeasure(ws,MeasureSpec.makeMeasureSpec(Math.round(a.getResources().getDisplayMetrics().heightPixels*.78f),MeasureSpec.EXACTLY));}};
            parent.addView(host,new LinearLayout.LayoutParams(-1,-2));build();host.addView(root,new android.widget.FrameLayout.LayoutParams(-1,-1));load();
            a.onPageCleanup(this::dispose);
        }
        void show(){inline(body);setFullscreen(true);}
        MediaIcon photoControl(LinearLayout row,String symbol,String description,Runnable click){MediaIcon v=new MediaIcon(symbol,Color.WHITE,19);v.setContentDescription(description);v.setOnClickListener(w->{click.run();updateZoom();});row.addView(v,new LinearLayout.LayoutParams(a.dp(36),a.dp(36)));return v;}
        void build(){
            root=new android.widget.FrameLayout(a);root.setBackground(a.shape(Color.BLACK,8));root.setClipToOutline(true);root.setFocusableInTouchMode(true);root.addView(image,new android.widget.FrameLayout.LayoutParams(-1,-1));
            prev=new MediaIcon("left",Color.WHITE,26);next=new MediaIcon("right",Color.WHITE,26);
            for(MediaIcon nav:new MediaIcon[]{prev,next}){nav.setBackground(a.shape(0x99000000,50));android.widget.FrameLayout.LayoutParams lp=new android.widget.FrameLayout.LayoutParams(a.dp(48),a.dp(48),Gravity.CENTER_VERTICAL|(nav==prev?Gravity.LEFT:Gravity.RIGHT));lp.setMargins(a.dp(12),0,a.dp(12),0);root.addView(nav,lp);}
            prev.setContentDescription("Önceki fotoğraf");next.setContentDescription("Sonraki fotoğraf");prev.setOnClickListener(v->move(0));next.setOnClickListener(v->move(1));image.swipe=this::move;
            LinearLayout pill=a.row();pill.setPadding(a.dp(8),a.dp(4),a.dp(8),a.dp(4));pill.setBackground(Ui.border(a,0xb3000000,0x26ffffff,30));
            photoControl(pill,"minus","Uzaklaştır (-)",()->image.zoomBy(1/1.4f));
            zoom=label("100%",12,Color.WHITE,800);zoom.setGravity(Gravity.CENTER);zoom.setContentDescription("Yakınlaştırmayı sıfırla (0)");zoom.setOnClickListener(v->{image.reset();updateZoom();});pill.addView(zoom,new LinearLayout.LayoutParams(a.dp(56),a.dp(36)));
            photoControl(pill,"plus","Yakınlaştır (+)",()->image.zoomBy(1.4f));photoControl(pill,"rotate","90° sağa döndür ve orijinale kaydet (R)",()->rotate(current,this::load));
            View divider=new View(a);divider.setBackgroundColor(0x33ffffff);LinearLayout.LayoutParams div=new LinearLayout.LayoutParams(a.dp(1),a.dp(20));div.setMargins(a.dp(4),0,a.dp(4),0);pill.addView(divider,div);
            full=photoControl(pill,"fullscreen","Tam ekran (F)",()->setFullscreen(!fullscreen));
            android.widget.FrameLayout.LayoutParams pp=new android.widget.FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);pp.bottomMargin=a.dp(12);root.addView(pill,pp);
            status=label("Fotoğraf yükleniyor…",13,Color.WHITE,500);status.setPadding(a.dp(12),a.dp(8),a.dp(12),a.dp(8));status.setBackground(a.shape(0xcc000000,6));android.widget.FrameLayout.LayoutParams st=new android.widget.FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.LEFT);st.setMargins(a.dp(12),a.dp(12),a.dp(12),0);root.addView(status,st);status.setOnClickListener(v->load());
            View.OnKeyListener keys=(v,key,event)->event.getAction()==KeyEvent.ACTION_DOWN&&!event.isCtrlPressed()&&!event.isAltPressed()&&!event.isMetaPressed()&&key(key);
            root.setOnKeyListener(keys);image.setOnKeyListener(keys);image.changed=this::updateZoom;
        }
        void updateZoom(){if(zoom!=null)zoom.setText(Math.round(image.scale*100)+"%");}
        boolean key(int key){switch(key){case KeyEvent.KEYCODE_DPAD_LEFT:move(0);break;case KeyEvent.KEYCODE_DPAD_RIGHT:move(1);break;case KeyEvent.KEYCODE_PLUS:case KeyEvent.KEYCODE_EQUALS:image.zoomBy(1.4f);break;case KeyEvent.KEYCODE_MINUS:image.zoomBy(1/1.4f);break;case KeyEvent.KEYCODE_0:image.reset();break;case KeyEvent.KEYCODE_R:rotate(current,this::load);break;case KeyEvent.KEYCODE_F:setFullscreen(!fullscreen);break;case KeyEvent.KEYCODE_ESCAPE:if(fullscreen)setFullscreen(false);else return false;break;default:return false;}updateZoom();return true;}
        void setFullscreen(boolean value){if(disposed||value==fullscreen)return;if(!value){if(dialog!=null)dialog.dismiss();return;}fullscreen=true;
            host.removeView(root);dialog=new Dialog(a,android.R.style.Theme_Material_NoActionBar_Fullscreen);dialog.setContentView(root);dialog.setOnKeyListener((d,k,e)->e.getAction()==KeyEvent.ACTION_DOWN&&key(k));dialog.setOnDismissListener(d->{fullscreen=false;dialog=null;if(disposed)return;if(root.getParent() instanceof ViewGroup)((ViewGroup)root.getParent()).removeView(root);host.addView(root,new android.widget.FrameLayout.LayoutParams(-1,-1));full.symbol="fullscreen";full.invalidate();image.requestFocus();if(current.optInt("id")!=initialId)detail(current.optInt("id"),scope,false);});
            dialog.show();Window w=dialog.getWindow();if(w!=null){w.setLayout(-1,-1);w.setBackgroundDrawableResource(android.R.color.black);w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);}full.symbol="minimize";full.invalidate();image.requestFocus();
        }
        void move(int direction){JSONObject n=adjacent[direction];if(n==null||disposed)return;if(!fullscreen){detail(n.optInt("id"),scope,true);return;}current=n;adjacent=new JSONObject[]{null,null};a.request("POST",api("/media/"+current.optInt("id")+"/view"),a.obj(),r->{});load();}
        void load(){if(disposed)return;int request=++loadId,id=current.optInt("id");image.clear();image.setContentDescription(current.optString("title")+". Çift dokunun: yakınlaştır. Kaydırın: önceki/sonraki.");status.setText("Fotoğraf yükleniyor…");status.setVisibility(View.VISIBLE);prev.setVisibility(View.GONE);next.setVisibility(View.GONE);updateZoom();
            loadImage(api("/file/"+id)+version(current),null,d->{if(valid(request)){image.setImage(d);status.setVisibility(View.GONE);updateZoom();}},error->{if(valid(request)){status.setText(error+" · Yeniden denemek için dokunun.");status.setVisibility(View.VISIBLE);}});
            // Collection is data-only: never populate a detached hidden view.
            neighbors(id,scope,null,n->{if(valid(request)){adjacent=n;prev.setVisibility(n[0]!=null?View.VISIBLE:View.GONE);next.setVisibility(n[1]!=null?View.VISIBLE:View.GONE);}});
        }
        boolean valid(int request){return !disposed&&request==loadId&&alive(token);}
        void dispose(){if(disposed)return;disposed=true;loadId++;ui.removeCallbacksAndMessages(null);if(dialog!=null)dialog.dismiss();image.clear();}
    }

    private void avatarLibrary(int profile,Query query){LinearLayout p=begin("Profil fotoğrafı seç","Seçilen fotoğraf kırpılır ve genel arşivden çıkarılır",3,()->avatarLibrary(profile,query));
        action(p,"Profilin kendi fotoğrafları",()->avatarLibrary(profile,new Query("IMAGE",profile)));
        action(p,"Genel arşiv",()->avatarLibrary(profile,new Query("IMAGE",0)));
        a.search(p,"Fotoğraf ara",q->{Query n=query.reset();n.q=q.trim();avatarLibrary(profile,n);});LinearLayout result=loading(p);
        a.get(listPath(query,query.page,"new"),data->{result.removeAllViews();List<JSONObject> list=rows(array(data,"items"));if(list.isEmpty())empty(result,"Fotoğraf bulunamadı");for(JSONObject m:list){LinearLayout c=surface(result);a.image(c,api("/thumb/"+m.optInt("id"))+version(m),170,()->crop(profile,m.optInt("id"),null,()->profile(profile)));action(c,m.optString("title"),()->crop(profile,m.optInt("id"),null,()->profile(profile)));}pagination(result,query.page,Math.max(1,data.optInt("pages",1)),n->{Query v=query.copy();v.page=n;avatarLibrary(profile,v);});});
    }

    /** SAF lives in a module-owned platform Fragment; no host callback or permission is required. */
    public static final class AvatarPicker extends Fragment {
        Consumer<Uri> picked;
        @Override public void onCreate(Bundle state){super.onCreate(state);if(state==null){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(i,417);}catch(Exception e){if(getActivity()!=null)((MainActivity)getActivity()).toast("Dosya seçici açılamadı");remove();}}else remove();}
        @Override public void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);Consumer<Uri> callback=picked;picked=null;if(request==417&&result==android.app.Activity.RESULT_OK&&data!=null&&data.getData()!=null&&callback!=null)callback.accept(data.getData());remove();}
        private void remove(){if(getFragmentManager()!=null)getFragmentManager().beginTransaction().remove(this).commitAllowingStateLoss();}
    }
    public static final class MediaPicker extends Fragment {
        Consumer<List<Uri>> picked;
        @Override public void onCreate(Bundle state){super.onCreate(state);if(state!=null){remove();return;}Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType(getArguments()==null?"*/*":getArguments().getString("mime","*/*"));i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);try{startActivityForResult(i,418);}catch(Exception e){if(getActivity()!=null)((MainActivity)getActivity()).toast("Dosya seçici açılamadı");remove();}}
        @Override public void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);Consumer<List<Uri>> callback=picked;picked=null;if(request==418&&result==android.app.Activity.RESULT_OK&&data!=null&&callback!=null){List<Uri> files=new ArrayList<>();if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++){Uri uri=data.getClipData().getItemAt(i).getUri();if(!files.contains(uri))files.add(uri);}}else if(data.getData()!=null)files.add(data.getData());if(!files.isEmpty())callback.accept(files);}remove();}
        private void remove(){if(getFragmentManager()!=null)getFragmentManager().beginTransaction().remove(this).commitAllowingStateLoss();}
    }
    private void pickMedia(int id,String mime){int token=revision;MediaPicker fragment=new MediaPicker();Bundle args=new Bundle();args.putString("mime",mime);fragment.setArguments(args);fragment.picked=files->{if(alive(token))uploadMedia(id,files);};a.getFragmentManager().beginTransaction().add(fragment,"gallery-upload-"+UUID.randomUUID()).commit();}
    private void uploadMedia(int id,List<Uri> files){int token=revision;LinearLayout p=a.column();p.setPadding(a.dp(20),a.dp(12),a.dp(20),a.dp(12));TextView status=a.text("Yükleme hazırlanıyor…",15,a.ink);p.addView(status);TextView summary=a.text("",13,a.muted);p.addView(summary);
        // Closing a progress dialog never implicitly cancels a completed write.
        AlertDialog dialog=new AlertDialog.Builder(a).setTitle("Fotoğraf / video yükle").setView(p).setCancelable(false).create();
        java.util.concurrent.atomic.AtomicBoolean cancel=new java.util.concurrent.atomic.AtomicBoolean();TextView stop=action(p,"Bu dosyadan sonra durdur",()->{cancel.set(true);status.setText("Geçerli dosya tamamlandıktan sonra durdurulacak…");});
        track(dialog);dialog.show();
        p.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){}public void onViewDetachedFromWindow(View v){cancel.set(true);}});
        new Thread(()->{int added=0,failed=0,images=0,videos=0;String lastError="";
            for(int i=0;i<files.size();i++){
                if(cancel.get()||!aliveBackground(token))break;
                int index=i+1;String label=displayName(files.get(i));a.runOnUiThread(()->{if(alive(token)&&dialog.isShowing())status.setText(index+" / "+files.size()+" · "+label);});
                try{JSONObject result=uploadMediaFile(id,files.get(i),label);added+=result.optInt("added");failed+=result.optInt("skipped");images+=result.optInt("images");videos+=result.optInt("videos");if(result.optInt("added")==0&&result.optInt("skipped")==0){failed++;lastError="Sunucu dosyanın eklendiğini doğrulamadı";}}
                catch(Exception e){failed++;lastError=message(e);}
                int ok=added,bad=failed;a.runOnUiThread(()->{if(alive(token)&&dialog.isShowing())summary.setText(ok+" eklendi · "+bad+" eklenemedi");});
            }
            int ok=added,bad=failed,photoCount=images,videoCount=videos;String error=lastError;
            a.runOnUiThread(()->{if(!alive(token)||!dialog.isShowing())return;stop.setVisibility(View.GONE);dialog.setCancelable(true);status.setText(ok+" dosya eklendi · "+bad+" dosya eklenemedi");summary.setText(photoCount+" fotoğraf · "+videoCount+" video"+(cancel.get()?"\nYükleme kullanıcı tarafından durduruldu.":"")+(error.isEmpty()?"":"\n"+error));action(p,"Profile dön",()->{dialog.dismiss();profile(id);});if(bad>0)a.note(p,"Desteklenen fotoğraflar: JPG, PNG, WEBP, GIF, AVIF (40 MB). Videolar: MP4, M4V, WEBM, MKV, MOV, AVI (190 MB). Eklenemeyen dosyaları tekrar seçebilirsiniz.");});
        },"gallery-media-upload").start();
    }
    private boolean aliveBackground(int token){return token==revision&&!a.isDestroyed()&&!a.isFinishing();}
    private String displayName(Uri uri){try(android.database.Cursor c=a.getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())return c.getString(0);}catch(Exception ignored){}return "dosya";}
    private JSONObject uploadMediaFile(int profile,Uri uri,String name)throws Exception{
        String lower=name.toLowerCase(Locale.ROOT);boolean video=lower.matches(".*\\.(mp4|m4v|webm|mkv|mov|avi)$"),image=lower.matches(".*\\.(jpg|jpeg|png|webp|gif|avif)$");if(!video&&!image)throw new java.io.IOException("Desteklenmeyen dosya: "+name);
        int limit=(video?190:40)*1024*1024;
        try(android.database.Cursor cursor=a.getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.SIZE},null,null,null)){if(cursor!=null&&cursor.moveToFirst()&&!cursor.isNull(0)&&cursor.getLong(0)>limit)throw new java.io.IOException(name+": Dosya en çok "+limit/1024/1024+" MB olabilir");}
        HttpURLConnection c=connection(api("/profiles/"+profile+"/upload"),"POST");c.setReadTimeout(360000);String boundary="Keremhub"+UUID.randomUUID();c.setDoOutput(true);c.setChunkedStreamingMode(65536);c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
        try{try(OutputStream out=c.getOutputStream()){String type=a.getContentResolver().getType(uri);if(type==null)type="application/octet-stream";write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\"files\"; filename=\""+name.replaceAll("[\\\"\\r\\n]","_")+"\"\r\nContent-Type: "+type+"\r\n\r\n");
            try(InputStream in=a.getContentResolver().openInputStream(uri)){if(in==null)throw new java.io.IOException("Dosya okunamadı");byte[] bytes=new byte[65536];int n,total=0;while((n=in.read(bytes))!=-1){total+=n;if(total>limit)throw new java.io.IOException("Dosya boyut sınırını aşıyor: "+name);out.write(bytes,0,n);}}
            write(out,"\r\n--"+boundary+"--\r\n");}
            int code=c.getResponseCode();InputStream stream=code<400?c.getInputStream():c.getErrorStream();String text=stream==null?"":new String(read(stream,1024*1024),StandardCharsets.UTF_8);JSONObject result=text.trim().isEmpty()?new JSONObject():new JSONObject(text);if(code>=400)throw new java.io.IOException(result.optString("error","Yükleme başarısız ("+code+")"));return result;
        }finally{c.disconnect();}
    }
    private void pickAvatar(int id){int token=revision;AvatarPicker fragment=new AvatarPicker();fragment.picked=uri->{if(alive(token))crop(id,0,uri,()->profile(id));};a.getFragmentManager().beginTransaction().add(fragment,"gallery-avatar-"+UUID.randomUUID()).commit();}
    private void crop(int profile,int media,Uri file,Runnable done){
        int token=revision;LinearLayout p=a.column();p.setPadding(a.dp(12),a.dp(12),a.dp(12),a.dp(12));
        ScrollView cropScroll=new ScrollView(a);cropScroll.addView(p);
        AlertDialog dialog=new AlertDialog.Builder(a).setTitle("Profil fotoğrafını ayarla").setView(cropScroll).setNegativeButton("Vazgeç",null).create();
        ZoomImage image=new ZoomImage(true);int side=Math.min(320,a.getResources().getConfiguration().screenWidthDp-72);p.addView(image,new LinearLayout.LayoutParams(-1,a.dp(Math.max(180,side))));
        TextView status=a.text("Yükleniyor…",13,a.muted);p.addView(status);a.note(p,"Sürükleyin ve yakınlaştırın. Kare kırpma sunucuya kaydedilir. Arşivden seçilen kaynak fotoğraf genel arşivden çıkarılır.");
        SeekBar zoom=new SeekBar(a);zoom.setMax(300);zoom.setProgressTintList(android.content.res.ColorStateList.valueOf(a.accent));zoom.setThumbTintList(android.content.res.ColorStateList.valueOf(a.accent));p.addView(zoom);zoom.setContentDescription("Kırpma yakınlaştırması: 1–4 kat");zoom.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}public void onProgressChanged(SeekBar s,int v,boolean user){if(user){image.scale=1+v/100f;image.constrain();image.invalidate();}}});
        action(p,"Sıfırla",()->{image.reset();zoom.setProgress(0);});
        TextView save=action(p,"Profil fotoğrafını kaydet",()->{});save.setBackground(a.shape(a.accent,8));save.setTextColor(a.bg);save.setEnabled(false);
        save.setOnClickListener(v->{if(image.drawable==null)return;save.setEnabled(false);dialog.setCancelable(false);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);status.setText("Kaydediliyor…");float[] values=image.cropValues();
            new Thread(()->{try{uploadAvatar(profile,media,file,values);a.runOnUiThread(()->{if(!alive(token)||!dialog.isShowing())return;dialog.dismiss();image.clear();done.run();});}catch(Exception e){a.runOnUiThread(()->{if(!alive(token)||!dialog.isShowing())return;save.setEnabled(true);dialog.setCancelable(true);dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);status.setText(message(e));});}},"gallery-avatar-upload").start();
        });
        track(dialog);dialog.show();
        p.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){}public void onViewDetachedFromWindow(View v){image.clear();}});
        loadImage(media>0?api("/file/"+media)+"?original=1&v="+System.currentTimeMillis():null,file,d->{if(dialog.isShowing()){image.setImage(d);save.setEnabled(true);status.setText("Sürükleyin · Yakınlaştırın · Kaydedin");}},error->{if(dialog.isShowing())status.setText(error);});
    }

    private HttpURLConnection connection(String path,String method)throws Exception{String root=a.base();while(root.endsWith("/"))root=root.substring(0,root.length()-1);URL url=new URL(root+path);HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setRequestMethod(method);c.setConnectTimeout(15000);c.setReadTimeout(120000);c.setRequestProperty("User-Agent","Keremhub-Android/1.0");URI u=url.toURI();c.setRequestProperty("Origin",u.getScheme()+"://"+u.getRawAuthority());return c;}
    private static String message(Exception e){String m=e.getMessage();return m==null||m.trim().isEmpty()?"İşlem tamamlanamadı. Bağlantıyı ve dosya biçimini kontrol edin.":m;}
    private static byte[] read(InputStream stream,int limit)throws Exception{try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(out.size()>limit-n)throw new java.io.IOException("Dosya çok büyük (en çok "+limit/1024/1024+" MB)");out.write(b,0,n);}return out.toByteArray();}}
    private void loadImage(String path,Uri file,Consumer<Drawable> done,Consumer<String> error){int token=revision;IMAGE_IO.execute(()->{if(!aliveBackground(token))return;try{
        byte[] bytes;if(file!=null){InputStream in=a.getContentResolver().openInputStream(file);if(in==null)throw new java.io.IOException("Dosya okunamadı");bytes=read(in,40*1024*1024);}else{HttpURLConnection c=connection(path,"GET");try{if(c.getResponseCode()>=400)throw new java.io.IOException("Fotoğraf yüklenemedi ("+c.getResponseCode()+")");bytes=read(c.getInputStream(),80*1024*1024);}finally{c.disconnect();}}
        Drawable decoded;
        if(Build.VERSION.SDK_INT>=28){decoded=ImageDecoder.decodeDrawable(ImageDecoder.createSource(ByteBuffer.wrap(bytes)),(decoder,info,source)->{int w=info.getSize().getWidth(),h=info.getSize().getHeight();float ratio=Math.min(1,3072f/Math.max(w,h));decoder.setTargetSize(Math.max(1,(int)(w*ratio)),Math.max(1,(int)(h*ratio)));decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);});}
        else decoded=legacyImage(bytes);
        a.runOnUiThread(()->{if(alive(token))done.accept(decoded);});
    }catch(Exception e){a.runOnUiThread(()->{if(alive(token))error.accept(message(e));});}catch(OutOfMemoryError e){a.runOnUiThread(()->{if(alive(token))error.accept("Görsel cihaz belleği için çok büyük");});}});}
    private Drawable legacyImage(byte[] bytes)throws Exception{
        Movie movie=Movie.decodeByteArray(bytes,0,bytes.length);
        if(movie!=null&&movie.duration()>0)return new MovieImage(movie);
        BitmapFactory.Options opts=new BitmapFactory.Options();opts.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,opts);opts.inSampleSize=1;while(Math.max(opts.outWidth,opts.outHeight)/opts.inSampleSize>3072)opts.inSampleSize*=2;opts.inJustDecodeBounds=false;Bitmap bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.length,opts);if(bitmap==null)throw new java.io.IOException("Bu görsel biçimi cihazda desteklenmiyor");Matrix orientation=new Matrix();try{ExifInterface exif=new ExifInterface(new ByteArrayInputStream(bytes));int o=exif.getAttributeInt(ExifInterface.TAG_ORIENTATION,1);if(o==2)orientation.setScale(-1,1);else if(o==3)orientation.setRotate(180);else if(o==4)orientation.setScale(1,-1);else if(o==5){orientation.setRotate(90);orientation.postScale(-1,1);}else if(o==6)orientation.setRotate(90);else if(o==7){orientation.setRotate(270);orientation.postScale(-1,1);}else if(o==8)orientation.setRotate(270);}catch(java.io.IOException ignored){}if(!orientation.isIdentity())bitmap=Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),orientation,true);return new BitmapDrawable(a.getResources(),bitmap);
    }
    /** GIF animation on API 26/27, where ImageDecoder is unavailable. */
    private static final class MovieImage extends Drawable implements Animatable {
        final Movie movie;final Paint paint=new Paint(3);boolean running;long started;
        final Runnable frame=()->{if(running){invalidateSelf();scheduleSelf(this.frame,android.os.SystemClock.uptimeMillis()+32);}};
        MovieImage(Movie source){movie=source;}
        @Override public int getIntrinsicWidth(){return movie.width();}
        @Override public int getIntrinsicHeight(){return movie.height();}
        @Override public void draw(Canvas canvas){int save=canvas.save();android.graphics.Rect bounds=getBounds();canvas.translate(bounds.left,bounds.top);canvas.scale(bounds.width()/(float)movie.width(),bounds.height()/(float)movie.height());movie.setTime((int)((android.os.SystemClock.uptimeMillis()-started)%Math.max(1,movie.duration())));movie.draw(canvas,0,0,paint);canvas.restoreToCount(save);}
        @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
        @Override public void setColorFilter(android.graphics.ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
        @Override public int getOpacity(){return android.graphics.PixelFormat.TRANSLUCENT;}
        @Override public void start(){if(running)return;running=true;started=android.os.SystemClock.uptimeMillis();frame.run();}
        @Override public void stop(){running=false;unscheduleSelf(frame);}
        @Override public boolean isRunning(){return running;}
    }
    private void uploadAvatar(int profile,int media,Uri file,float[] crop)throws Exception{
        HttpURLConnection c=connection(api("/profiles/"+profile+"/avatar"),"POST");String boundary="Keremhub"+UUID.randomUUID();c.setDoOutput(true);c.setChunkedStreamingMode(16384);c.setRequestProperty("Accept","application/json");c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
        try{try(OutputStream out=c.getOutputStream()){
            for(int i=0;i<3;i++)part(out,boundary,new String[]{"x","y","size"}[i],String.valueOf(crop[i]));
            if(file==null)part(out,boundary,"mediaId",String.valueOf(media));else{String type=a.getContentResolver().getType(file);if(type==null||!type.startsWith("image/"))type="application/octet-stream";
                write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"avatar\"\r\nContent-Type: "+type+"\r\n\r\n");
                try(InputStream in=a.getContentResolver().openInputStream(file)){if(in==null)throw new java.io.IOException("Dosya okunamadı");byte[] b=new byte[16384];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>40*1024*1024)throw new java.io.IOException("Profil fotoğrafı en çok 40 MB olabilir");out.write(b,0,n);}}write(out,"\r\n");}
            write(out,"--"+boundary+"--\r\n");}
            int code=c.getResponseCode();InputStream response=code<400?c.getInputStream():c.getErrorStream();String text=response==null?"":new String(read(response,1024*1024),StandardCharsets.UTF_8);JSONObject result=text.trim().isEmpty()?new JSONObject():new JSONObject(text);if(code>=400||!result.optBoolean("ok"))throw new java.io.IOException(result.optString("error","Profil fotoğrafı kaydedilemedi ("+code+")"));
        }finally{c.disconnect();}
    }
    private static void write(OutputStream out,String s)throws Exception{out.write(s.getBytes(StandardCharsets.UTF_8));}
    private static void part(OutputStream out,String boundary,String key,String value)throws Exception{write(out,"--"+boundary+"\r\nContent-Disposition: form-data; name=\""+key+"\"\r\n\r\n"+value+"\r\n");}

    /** Contained image viewer and square cropper. Crop coordinates exactly match
     * server fractions of oriented width/height and the shorter edge. */
    private final class ZoomImage extends View implements Drawable.Callback {
        Drawable drawable;final boolean crop;float scale=1,x,y,lastX,lastY,downX,downY;boolean pinched;
        java.util.function.IntConsumer swipe;Runnable changed;
        final ScaleGestureDetector pinch;final GestureDetector gestures;final Paint paint=new Paint(3);
        ZoomImage(boolean crop){super(a);this.crop=crop;setBackgroundColor(Color.BLACK);setFocusable(true);
            pinch=new ScaleGestureDetector(a,new ScaleGestureDetector.SimpleOnScaleGestureListener(){@Override public boolean onScale(ScaleGestureDetector detector){pinched=true;float old=scale;scale=clamp(scale*detector.getScaleFactor(),1,crop?4:8);float factor=scale/old;float px=detector.getFocusX()-getWidth()/2f,py=detector.getFocusY()-getHeight()/2f;x=px-(px-x)*factor;y=py-(py-y)*factor;constrain();invalidate();return true;}});
            gestures=new GestureDetector(a,new GestureDetector.SimpleOnGestureListener(){@Override public boolean onDown(MotionEvent e){return true;}@Override public boolean onDoubleTap(MotionEvent e){if(scale>1.01f)reset();else zoomBy(2.5f);return true;}});
        }
        void setImage(Drawable d){clear();drawable=d;d.setCallback(this);reset();if(d instanceof Animatable)((Animatable)d).start();}
        void clear(){if(drawable instanceof Animatable)((Animatable)drawable).stop();if(drawable!=null)drawable.setCallback(null);drawable=null;invalidate();}
        void reset(){scale=1;x=0;y=0;invalidate();if(changed!=null)changed.run();}
        void zoomBy(float factor){scale=clamp(scale*factor,1,crop?4:8);if(scale==1){x=0;y=0;}constrain();invalidate();if(changed!=null)changed.run();}
        float fit(){if(drawable==null)return 1;return crop?Math.min(getWidth(),getHeight())/(float)Math.min(drawable.getIntrinsicWidth(),drawable.getIntrinsicHeight()):Math.min(getWidth()/(float)drawable.getIntrinsicWidth(),getHeight()/(float)drawable.getIntrinsicHeight());}
        void constrain(){if(drawable==null)return;float w=drawable.getIntrinsicWidth()*fit()*scale,h=drawable.getIntrinsicHeight()*fit()*scale;float boxW=crop?Math.min(getWidth(),getHeight()):getWidth(),boxH=crop?boxW:getHeight();x=clamp(x,-Math.max(0,(w-boxW)/2),Math.max(0,(w-boxW)/2));y=clamp(y,-Math.max(0,(h-boxH)/2),Math.max(0,(h-boxH)/2));}
        float[] cropValues(){float side=Math.min(getWidth(),getHeight()),w=drawable.getIntrinsicWidth()*fit()*scale,h=drawable.getIntrinsicHeight()*fit()*scale;return new float[]{Math.max(0,((w-side)/2-x)/w),Math.max(0,((h-side)/2-y)/h),1/scale};}
        @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){super.onSizeChanged(w,h,oldw,oldh);constrain();}
        @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);if(drawable==null)return;int w=drawable.getIntrinsicWidth(),h=drawable.getIntrinsicHeight();if(w<=0||h<=0)return;float f=fit()*scale;int save=canvas.save();if(crop){float side=Math.min(getWidth(),getHeight());canvas.clipRect((getWidth()-side)/2,(getHeight()-side)/2,(getWidth()+side)/2,(getHeight()+side)/2);}canvas.translate(getWidth()/2f+x,getHeight()/2f+y);canvas.scale(f,f);canvas.translate(-w/2f,-h/2f);drawable.setBounds(0,0,w,h);drawable.draw(canvas);canvas.restoreToCount(save);
            if(crop){float side=Math.min(getWidth(),getHeight()),left=(getWidth()-side)/2,top=(getHeight()-side)/2;paint.setColor(0x99ffffff);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(a.dp(1));canvas.drawRect(left,top,left+side,top+side,paint);canvas.drawOval(new RectF(left,top,left+side,top+side),paint);for(int i=1;i<3;i++){float t=side*i/3;canvas.drawLine(left+t,top,left+t,top+side,paint);canvas.drawLine(left,top+t,left+side,top+t,paint);}}
        }
        @Override public boolean onTouchEvent(MotionEvent event){if(drawable==null)return true;pinch.onTouchEvent(event);gestures.onTouchEvent(event);switch(event.getActionMasked()){
            case MotionEvent.ACTION_DOWN:lastX=downX=event.getX();lastY=downY=event.getY();pinched=false;getParent().requestDisallowInterceptTouchEvent(true);break;
            case MotionEvent.ACTION_POINTER_DOWN:pinched=true;break;
            case MotionEvent.ACTION_MOVE:if(!pinch.isInProgress()&&event.getPointerCount()==1){x+=event.getX()-lastX;y+=event.getY()-lastY;constrain();invalidate();}lastX=event.getX();lastY=event.getY();break;
            case MotionEvent.ACTION_UP:if(!crop&&!pinched&&scale<=1.01f&&swipe!=null&&Math.abs(event.getX()-downX)>a.dp(65)&&Math.abs(event.getY()-downY)<a.dp(90))swipe.accept(event.getX()>downX?0:1);performClick();getParent().requestDisallowInterceptTouchEvent(false);break;
            case MotionEvent.ACTION_CANCEL:getParent().requestDisallowInterceptTouchEvent(false);break;
        }return true;}
        @Override public boolean performClick(){super.performClick();return true;}
        @Override public void invalidateDrawable(Drawable who){invalidate();}
        @Override public void scheduleDrawable(Drawable who,Runnable what,long when){postDelayed(what,Math.max(0,when-android.os.SystemClock.uptimeMillis()));}
        @Override public void unscheduleDrawable(Drawable who,Runnable what){removeCallbacks(what);}
        @Override protected void onAttachedToWindow(){super.onAttachedToWindow();if(drawable instanceof Animatable)((Animatable)drawable).start();}
        @Override protected void onDetachedFromWindow(){if(drawable instanceof Animatable)((Animatable)drawable).stop();super.onDetachedFromWindow();}
    }
    private static float clamp(float value,float low,float high){return Math.max(low,Math.min(high,value));}
}
