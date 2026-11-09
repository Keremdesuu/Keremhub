package com.keremhub.app;

import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Native Keremflix client. All paths and payloads match inspection/keremflix.
 * The mobile API has no list GET or uncapped catalogue endpoint. Only those two
 * indexes are read from existing HTML anchors; no HTML is displayed or executed.
 * Playback, progress persistence and player lifecycle belong to MainActivity.play.
 */
public final class FlixScreen {
    private static final String API = "/keremflix/api/";
    private static final int BG = 0xff141414, SURFACE = 0xff222222;
    private static final int WHITE = 0xffffffff, MUTED = 0xffb3b3b3;
    private static final int RED = 0xffe50914, GREEN = 0xff46d369;
    private static final String[] KINDS = {"", "SERIES", "MOVIE", "ANIME"};
    private static final String[] TABS = {"Ana Sayfa", "Diziler", "Filmler", "Animeler", "Listem"};
    private static final Pattern TITLE_LINK = Pattern.compile(
            "\\bhref\\s*=\\s*[\"'](?:/keremflix)?/title/(\\d+)(?:[?#][^\"']*)?[\"']",
            Pattern.CASE_INSENSITIVE);
    private final MainActivity a;
    private final Handler main = new Handler(Looper.getMainLooper());
    private LinearLayout body;
    private int epoch;
    private String kind = "";
    private int tab;
    private boolean scanBusy;
    private final LinkedHashMap<Integer, Integer> selectedSeasons = new LinkedHashMap<>();
    private String searchDraft = "";
    private boolean searchOpen;

    private int width() { return a.getResources().getConfiguration().screenWidthDp; }
    private int gutter() { return Math.round(width() * .04f); }
    private int columns() { return Math.max(1, (width() - gutter() * 2 + 8) / 238); }

    private FlixScreen(MainActivity activity) { a = activity; }

    public static void show(MainActivity a) { new FlixScreen(a).browse(""); }

    private LinearLayout page(String subtitle, Runnable reload, int selected) {
        epoch++;
        a.theme(BG, SURFACE, WHITE, MUTED, RED);
        body = a.page("KEREMFLIX", subtitle);
        a.remember(reload);
        body.setPadding(0,0,0,a.dp(64));
        final LinearLayout pageBody = body;
        final int[] previousWidth = {width()};
        final Runnable[] resize = {null};
        a.root.addOnLayoutChangeListener((view,l,t,r,b,ol,ot,or,ob) -> {
            int nextWidth = width();
            if (nextWidth == previousWidth[0] || a.body != pageBody) return;
            previousWidth[0] = nextWidth;
            if (resize[0] != null) main.removeCallbacks(resize[0]);
            int scrollY = a.scroll.getScrollY();
            resize[0] = () -> {
                if (a.body != pageBody) return;
                reload.run();
                a.scroll.post(() -> a.scroll.scrollTo(0,scrollY));
            };
            main.postDelayed(resize[0],100);
        });
        a.onPageCleanup(() -> { epoch++; if (resize[0] != null) main.removeCallbacks(resize[0]); });
        LinearLayout header=Ui.fixedHeader(a);
        LinearLayout brand=a.row();brand.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);
        TextView logo = a.text("KEREMFLIX", 27, RED);
        logo.setTypeface(a.font("bebas",400));logo.setLetterSpacing(.025f);
        brand.addView(logo,new LinearLayout.LayoutParams(0,a.dp(56),1));logo.setGravity(Gravity.CENTER_VERTICAL);
        logo.setOnClickListener(v->browse(""));logo.setOnLongClickListener(v->{a.hub();return true;});
        View searchIcon=Ui.icon(a,"search",32,WHITE,null);searchIcon.setContentDescription("Ara");
        brand.addView(searchIcon);
        View bell=Ui.icon(a,"bell",36,WHITE,()->a.choose("Keremflix",new String[]{"Kütüphaneyi tara","Yenile","Keremhub’a dön"},i->{if(i==0)scanOptions();else if(i==1)reload.run();else a.hub();}));bell.setContentDescription("Kütüphaneyi yeniden tara");brand.addView(bell);
        EditText input=new EditText(a);input.setSingleLine(true);input.setTextColor(WHITE);input.setHintTextColor(MUTED);input.setTextSize(14);input.setTypeface(a.font("inter",400));input.setHint("Başlık ara");input.setText(searchDraft);input.setPadding(a.dp(8),0,a.dp(8),0);input.setBackground(Ui.border(a,0xb3000000,0x99ffffff,6));input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);input.setVisibility(View.GONE);
        brand.addView(input,1,new LinearLayout.LayoutParams(0,a.dp(36),1));
        input.setVisibility(searchOpen?View.VISIBLE:View.GONE);logo.setVisibility(searchOpen&&width()<640?View.GONE:View.VISIBLE);
        input.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){searchDraft=s.toString();}public void afterTextChanged(android.text.Editable value){}});
        searchIcon.setOnClickListener(v->{boolean open=input.getVisibility()!=View.VISIBLE;searchOpen=open;input.setVisibility(open?View.VISIBLE:View.GONE);logo.setVisibility(open&&width()<640?View.GONE:View.VISIBLE);if(open){input.requestFocus();((InputMethodManager)a.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).showSoftInput(input,InputMethodManager.SHOW_IMPLICIT);}else ((InputMethodManager)a.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(),0);});
        input.setOnEditorActionListener((v,id,event)->{if(id==EditorInfo.IME_ACTION_SEARCH||(event!=null&&event.getKeyCode()==android.view.KeyEvent.KEYCODE_ENTER&&event.getAction()==android.view.KeyEvent.ACTION_UP)){String q=input.getText().toString().trim();if(!q.isEmpty()){searchDraft=q;((InputMethodManager)a.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(),0);a.navigate(()->search(q,""));}return true;}return false;});
        LinearLayout hub=a.row();hub.setGravity(Gravity.CENTER);hub.setPadding(a.dp(4),0,a.dp(width()>=640?12:4),0);
        hub.setBackground(Ui.border(a,0x14ffffff,0x33ffffff,10));
        hub.addView(Ui.icon(a,"home",32,WHITE,null));
        if(width()>=640){TextView caption=a.text("Keremhub",13,WHITE);caption.setPadding(a.dp(4),0,0,0);hub.addView(caption);}
        LinearLayout.LayoutParams hubLp=new LinearLayout.LayoutParams(-2,a.dp(44));hubLp.leftMargin=a.dp(8);brand.addView(hub,hubLp);
        hub.setContentDescription("Ana hub’a dön");hub.setTooltipText("Keremhub ana sayfa");hub.setFocusable(true);
        hub.setOnClickListener(v->{((InputMethodManager)a.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(input.getWindowToken(),0);a.hub();});
        if(width()>=640){View user=Ui.icon(a,"users",32,WHITE,null);user.setBackground(a.shape(RED,4));LinearLayout.LayoutParams userLp=new LinearLayout.LayoutParams(a.dp(32),a.dp(32));userLp.setMargins(a.dp(12),0,0,0);brand.addView(user,userLp);}
        header.addView(brand,new LinearLayout.LayoutParams(-1,a.dp(56)));
        Ui.line(a,header,0xff262626);
        HorizontalScrollView tabs=new HorizontalScrollView(a);tabs.setHorizontalScrollBarEnabled(false);LinearLayout tabsRow=a.row();tabsRow.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);tabs.addView(tabsRow);header.addView(tabs,new LinearLayout.LayoutParams(-1,a.dp(48)));
        for(int i=0;i<TABS.length;i++){final int index=i;LinearLayout tabView=a.column();TextView text=a.text(TABS[i],14,i==selected?WHITE:0xffcccccc);text.setTypeface(a.font("inter",i==selected?600:400));text.setGravity(Gravity.CENTER_VERTICAL);tabView.addView(text,new LinearLayout.LayoutParams(-2,a.dp(46)));View line=new View(a);line.setBackgroundColor(i==selected?RED:Color.TRANSPARENT);tabView.addView(line,new LinearLayout.LayoutParams(-1,a.dp(2)));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-2,-1);lp.setMargins(0,0,i<TABS.length-1?a.dp(20):0,0);tabsRow.addView(tabView,lp);tabView.setOnClickListener(v->{
            if (index < 4) a.navigate(() -> browse(KINDS[index]));
            else if (index == 4) a.navigate(this::myList);
        });}
        return body;
    }

    private boolean current(int token, View view) {
        return token == epoch && !a.isFinishing() && !a.isDestroyed() && view.isAttachedToWindow();
    }

    private LinearLayout section(LinearLayout parent) {
        LinearLayout area = a.column();
        parent.addView(area, new LinearLayout.LayoutParams(-1, -2));
        return area;
    }

    private TextView label(LinearLayout parent, String value, int size, int color) {
        TextView text = a.text(value, size, color);
        text.setPadding(0, a.dp(4), 0, a.dp(4));
        parent.addView(text);
        return text;
    }

    private TextView action(LinearLayout parent, String value, Runnable click, boolean primary) {
        TextView button = a.text(value, 14, primary ? BG : WHITE);
        button.setTypeface(null, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setMinHeight(a.dp(48));
        button.setPadding(a.dp(14), a.dp(10), a.dp(14), a.dp(10));
        button.setBackground(a.shape(primary ? WHITE : 0xff333333, 6));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.setMargins(0, a.dp(4), a.dp(8), a.dp(4));
        parent.addView(button, lp);
        button.setContentDescription(value);
        button.setOnClickListener(v -> click.run());
        return button;
    }

    private LinearLayout actions(LinearLayout parent) {
        HorizontalScrollView scroll = new HorizontalScrollView(a);
        scroll.setHorizontalScrollBarEnabled(false);
        LinearLayout row = a.row();
        scroll.addView(row);
        parent.addView(scroll, new LinearLayout.LayoutParams(-1, -2));
        return row;
    }

    private void pending(LinearLayout area, String message, Runnable retry) {
        LinearLayout loading=a.row();loading.setPadding(a.dp(gutter()),a.dp(16),a.dp(gutter()),a.dp(16));
        ProgressBar spinner=new ProgressBar(a);spinner.setIndeterminateTintList(ColorStateList.valueOf(RED));loading.addView(spinner,new LinearLayout.LayoutParams(a.dp(24),a.dp(24)));
        TextView status=a.text(message,14,MUTED);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMargins(a.dp(12),0,0,0);loading.addView(status,lp);area.addView(loading);
        int token=epoch;main.postDelayed(()->{if(current(token,loading))action(area,"Tekrar dene",retry,false);},15000);
    }

    private void browse(String selectedKind) {
        kind = selectedKind;
        tab = kindIndex(selectedKind);
        LinearLayout parent = page(selectedKind.isEmpty() ? "Sıradaki favorini keşfet" : plural(selectedKind),
                () -> browse(selectedKind), tab);
        LinearLayout content = section(parent);
        int token = epoch;
        pending(content, "Kütüphane yükleniyor…", () -> browse(selectedKind));
        a.get(API + "mobile/home" + (selectedKind.isEmpty() ? "" : "?kind=" + selectedKind), data -> {
            if (token != epoch) return;
            content.removeAllViews();
            if (apiError(content, data, () -> browse(selectedKind))) return;
            JSONObject hero = data.optJSONObject("hero");
            if (hero == null) {
                heading(content, "Kütüphane henüz boş");
                a.note(content, "Sunucudaki diziler, filmler veya animeler klasörlerine içerik ekledikten sonra kütüphaneyi tara.");
                action(content, "Kütüphaneyi Tara", this::scanOptions, false);
            } else {
                hero(content, hero, false);
            }
            titleRow(content, "İzlemeye Devam Et", array(data, "continueWatching"), false);
            titleRow(content, selectedKind.isEmpty() ? "Yeni Eklenenler" : "Yeni Eklenen " + plural(selectedKind),
                    first(array(data, "recent"),20), false);
            if(array(data,"topRated").length()>=3)titleRow(content, "En Yüksek Puanlı 10"+(selectedKind.isEmpty()?"":" "+singular(selectedKind)), array(data, "topRated"), true);
            if (selectedKind.isEmpty()) {
                for (int i = 1; i < KINDS.length; i++) {
                    String k = KINDS[i];
                    LinearLayout rowArea = section(content);
                    a.get(API + "mobile/home?kind=" + k, category -> {
                        if (token == epoch) titleRow(rowArea, plural(k), first(array(category, "recent"),20), false);
                    });
                }
            }
            JSONArray genres = array(data, "genres");
            for (int i = 0; i < genres.length(); i++) {
                JSONObject group = genres.optJSONObject(i);
                if (group == null) continue;
                String genre = str(group, "genre");
                TextView heading = heading(content, genre);
                heading.setOnClickListener(v -> a.navigate(() -> catalogue(selectedKind, genre)));
                cards(content, array(group, "items"), false);
            }
            if (!selectedKind.isEmpty()) {
                LinearLayout catalogue = section(content);
                heading(catalogue, "Tüm " + plural(selectedKind));
                loadIndex(catalogue, route(selectedKind), selectedKind, "", false);
            }
        });
    }

    /** Match Hero.tsx: stacked artwork below lg (1024px), layered above it. */
    private void hero(LinearLayout parent, JSONObject title, boolean detail) {
        FrameLayout scene = new FrameLayout(a);
        int imageHeight = Math.round(width()*9f/16);
        int viewportHeight=a.getResources().getConfiguration().screenHeightDp;
        boolean overlay=width()>=1024;
        if(overlay)scene.setMinimumHeight(a.dp(Math.max(imageHeight,Math.round(viewportHeight*(detail?.56f:.78f))-104)));
        LinearLayout stack = a.column();
        parent.addView(scene,new LinearLayout.LayoutParams(-1,-2));
        if (hasArtwork(title)) {
            LinearLayout artwork = a.column();
            a.image(artwork,artwork(title,"hero"),imageHeight,()->openDetail(title));
            ImageView image=(ImageView)artwork.getChildAt(0);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setClipToOutline(false);
            if(overlay)image.setLayoutParams(new LinearLayout.LayoutParams(-1,-1));
            image.setBackgroundColor(BG);
            if(!overlay)stack.addView(artwork,new LinearLayout.LayoutParams(-1,a.dp(imageHeight)));
            else {
            scene.addView(artwork,new FrameLayout.LayoutParams(-1,-1));
            View sideShade=new View(a);
            sideShade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,new int[]{0xe6141414,0x99141414,0x1a141414}));
            scene.addView(sideShade,new FrameLayout.LayoutParams(-1,-1));
            View bottomShade=new View(a);
            bottomShade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x33000000,0x33141414,0xcc141414,BG}));
            scene.addView(bottomShade,new FrameLayout.LayoutParams(-1,-1));
            }
        } else if(!overlay)a.space(stack,imageHeight);
        // Content participates in measurement, so wrapped titles and controls
        // expand the backdrop instead of clipping at a fixed hero height.
        scene.addView(stack,new FrameLayout.LayoutParams(-1,-2,overlay?Gravity.BOTTOM:Gravity.TOP));
        if(overlay)a.space(stack,Math.max(detail?112:96,Math.min(200,Math.round(imageHeight*(detail?.5f:.38f)))));
        if(detail) {
            LinearLayout back=a.row();
            back.addView(Ui.icon(a,"back",30,0xffe5e5e5,null));
            TextView category=a.text(singular(str(title,"kind")),16,0xffe5e5e5);back.addView(category);
            FrameLayout.LayoutParams bp=new FrameLayout.LayoutParams(-2,a.dp(36),Gravity.TOP|Gravity.LEFT);
            bp.setMargins(a.dp(gutter()),a.dp(8),0,0);scene.addView(back,bp);
            back.setContentDescription("Geri: "+singular(str(title,"kind")));
            back.setOnClickListener(v->a.navigate(()->browse(str(title,"kind"))));
        }
        LinearLayout copy=a.column();copy.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);
        stack.addView(copy,new LinearLayout.LayoutParams(-1,-2));
        if(!detail) {
            LinearLayout kicker=a.row();TextView k=a.text("K",22,RED);k.setTypeface(a.font("bebas",400));kicker.addView(k);
            TextView category=a.text(singular(str(title,"kind")).toUpperCase(Locale.forLanguageTag("tr")),13,0xffe5e5e5);
            category.setTypeface(a.font("inter",500));category.setLetterSpacing(.35f);
            LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-2,-2);cp.setMargins(a.dp(8),0,0,0);kicker.addView(category,cp);
            copy.addView(kicker,new LinearLayout.LayoutParams(-1,a.dp(29)));a.space(copy,12);
        }
        TextView name=a.text(str(title,"title"),width()>=768?55:width()>=640?36:30,WHITE);
        name.setTypeface(a.font("inter",700));name.setLineSpacing(0,width()>=768?1:1.02f);copy.addView(name);
        int playId=preferredEpisode(title);
        if(detail) {
            a.space(copy,20);Flow buttons=new Flow(12,12);copy.addView(buttons,new LinearLayout.LayoutParams(-1,-2));
            if(playId>0)heroAction(buttons,title.optInt("resumeEpisodeId")>0?"Devam Et":"Oynat","play",true,()->loadAndPlay(title.optInt("id"),playId,false));
            roundList(buttons,title);titleActions(copy,title);a.space(copy,32);
            return;
        }
        a.space(copy,16);Flow metadata=new Flow(12,12);copy.addView(metadata,new LinearLayout.LayoutParams(-1,-2));
        if(title.optBoolean("isNew"))metaLabel(metadata,"Yeni",GREEN,false);
        if(title.optDouble("rating",0)>0)metaLabel(metadata,"%"+Math.round(title.optDouble("rating")*10)+" eşleşme",GREEN,false);
        if(title.optInt("year")>0)metaLabel(metadata,String.valueOf(title.optInt("year")),0xffe5e5e5,false);
        if(title.optInt("seasons")>1)metaLabel(metadata,title.optInt("seasons")+" Sezon",0xffe5e5e5,false);
        if(!str(title,"certification").isEmpty())metaLabel(metadata,str(title,"certification"),0xffdddddd,true);
        quality(metadata,str(title,"quality"));
        if(!str(title,"overview").isEmpty()) {
            a.space(copy,16);TextView overview=a.text(str(title,"overview"),18,0xffe5e5e5);
            overview.setLineSpacing(0,1.5f);overview.setMaxLines(3);overview.setEllipsize(android.text.TextUtils.TruncateAt.END);
            copy.addView(overview,new LinearLayout.LayoutParams(a.dp(Math.min(560,width()-gutter()*2)),-2));
        }
        a.space(copy,24);Flow buttons=new Flow(12,12);copy.addView(buttons,new LinearLayout.LayoutParams(-1,-2));
        if(playId>0)heroAction(buttons,title.optInt("resumeEpisodeId")>0?"Devam Et":"Oynat","play",true,()->loadAndPlay(title.optInt("id"),playId,false));
        heroAction(buttons,"Daha Fazla Bilgi","info",false,()->openDetail(title));roundList(buttons,title);
        // CSS pb-28 combined with -mb-20 leaves 32px before the first row.
        a.space(copy,32);
    }

    private void metaLabel(ViewGroup row,String value,int color,boolean border) {
        TextView text=a.text(value,border?11:16,color);text.setTypeface(a.font("inter",border?500:400));text.setLineSpacing(0,1.5f);
        if(border){text.setPadding(a.dp(5),0,a.dp(5),0);text.setBackground(Ui.border(a,Color.TRANSPARENT,0xff8c8c8c,3));}
        row.addView(text,new ViewGroup.LayoutParams(-2,-2));
    }
    private void quality(ViewGroup parent,String value) {
        if(value.isEmpty())return;
        metaLabel(parent,value.replace("+HDR",""),0xffe5e5e5,true);
        if(value.contains("HDR"))metaLabel(parent,"HDR",0xffe5e5e5,true);
    }
    private void heroAction(ViewGroup parent,String title,String icon,boolean primary,Runnable click) {
        LinearLayout button=a.row();button.setGravity(Gravity.CENTER);int padding=primary?28:24;
        button.setPadding(a.dp(padding),a.dp(10),a.dp(padding),a.dp(10));button.setBackground(a.shape(primary?WHITE:0xff303030,6));
        View glyph=Ui.icon(a,icon,primary?28:26,primary?Color.BLACK:WHITE,null);button.addView(glyph);
        TextView text=a.text(title,20,primary?Color.BLACK:WHITE);text.setTypeface(a.font("inter",500));text.setSingleLine(true);
        LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(-2,-2);tp.setMargins(a.dp(8),0,0,0);button.addView(text,tp);
        parent.addView(button,new ViewGroup.LayoutParams(-2,a.dp(50)));button.setOnClickListener(v->click.run());button.setContentDescription(title);
    }
    private void roundList(ViewGroup parent,JSONObject title) {
        LinearLayout holder=a.row();listButton(holder,title);
        TextView list=(TextView)holder.getChildAt(0);list.setBackground(Ui.border(a,0x992a2a2a,0x80ffffff,46));
        list.setTextSize(28);list.setTypeface(a.font("inter",400));list.setPadding(0,0,0,0);list.setMinHeight(0);
        list.setLayoutParams(new LinearLayout.LayoutParams(a.dp(46),a.dp(46)));
        list.setContentDescription(title.optBoolean("inList")?"Listemden çıkar":"Listeme ekle");
        parent.addView(holder,new ViewGroup.LayoutParams(a.dp(46),a.dp(50)));
    }

    /** Wrapping rows model flex-wrap for metadata and actions without a WebView. */
    private final class Flow extends ViewGroup {
        private final int gap,lineGap;
        Flow(int horizontal,int vertical){super(a);gap=a.dp(horizontal);lineGap=a.dp(vertical);}
        @Override protected void onMeasure(int w,int h) {
            int max=MeasureSpec.getSize(w),x=0,y=0,line=0;
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);ViewGroup.LayoutParams lp=child.getLayoutParams();child.measure(MeasureSpec.makeMeasureSpec(lp.width>=0?Math.min(max,lp.width):max,lp.width>=0?MeasureSpec.EXACTLY:MeasureSpec.AT_MOST),MeasureSpec.makeMeasureSpec(lp.height>=0?lp.height:0,lp.height>=0?MeasureSpec.EXACTLY:MeasureSpec.UNSPECIFIED));
                int cw=child.getMeasuredWidth(),ch=child.getMeasuredHeight();if(x>0&&x+cw>max){y+=line+lineGap;x=0;line=0;}x+=cw+gap;line=Math.max(line,ch);}
            setMeasuredDimension(max,resolveSize(y+line,h));
        }
        @Override protected void onLayout(boolean changed,int l,int t,int r,int b) {
            int x=0,y=0,line=0,max=r-l;
            for(int i=0;i<getChildCount();i++){View child=getChildAt(i);int cw=child.getMeasuredWidth(),ch=child.getMeasuredHeight();if(x>0&&x+cw>max){y+=line+lineGap;x=0;line=0;}child.layout(x,y,x+cw,y+ch);x+=cw+gap;line=Math.max(line,ch);}
        }
    }

    private void listButton(LinearLayout parent, JSONObject title) {
        TextView button = action(parent, listLabel(title.optBoolean("inList")), () -> {}, false);
        boolean[] busy = {false};
        button.setOnClickListener(v -> {
            if (busy[0]) return;
            busy[0] = true;
            button.setText("…");
            button.setContentDescription("Liste güncelleniyor");
            int token = epoch;
            a.request("POST", API + "list", a.obj("titleId", title.optInt("id")), result -> {
                if (token != epoch) return;
                busy[0] = false;
                if (!result.has("inList") || result.has("error")) {
                    button.setText(listLabel(title.optBoolean("inList")));
                    a.toast(fallback(str(result, "error"), "Liste güncellenemedi. Yeniden dene."));
                    return;
                }
                boolean included = result.optBoolean("inList");
                try { title.put("inList", included); } catch (Exception ignored) { }
                button.setText(listLabel(included));
                button.setContentDescription(included ? "Listemden çıkar" : "Listeme ekle");
                a.toast(included ? "Listene eklendi" : "Listenden çıkarıldı");
            });
            // A failed shared request has no callback. Unlock without assuming
            // success; the next tap first reloads server state before toggling.
            main.postDelayed(() -> {
                if (token != epoch || !busy[0]) return;
                busy[0] = false;
                button.setText("↻");button.setContentDescription("Liste durumunu yenile");
                button.setOnClickListener(view -> a.get(API + "mobile/title/" + title.optInt("id"), data -> {
                    JSONObject fresh = data.optJSONObject("title");
                    if (fresh == null) return;
                    int position = parent.indexOfChild(button);
                    parent.removeView(button);
                    int before = parent.getChildCount();
                    listButton(parent, fresh);
                    View replacement = parent.getChildAt(before);
                    parent.removeView(replacement);
                    parent.addView(replacement, Math.max(0, position));
                }));
            }, 35000);
        });
    }

    private static String listLabel(boolean included) { return included ? "✓" : "+"; }

    private void titleRow(LinearLayout parent, String heading, JSONArray items, boolean ranked) {
        if (items.length() == 0) return;
        heading(parent, heading);
        cards(parent, items, ranked);
        a.space(parent, 48);
    }

    private void cards(LinearLayout parent, JSONArray items, boolean ranked) {
        cards(parent, items, ranked, false);
    }

    private TextView heading(LinearLayout parent,String value){TextView t=a.text(value,21,WHITE);t.setTypeface(a.font("inter",500));t.setPadding(a.dp(gutter()),a.dp(8),a.dp(gutter()),0);t.setLineSpacing(0,1.5f);parent.addView(t,new LinearLayout.LayoutParams(-1,-2));return t;}

    private void cards(LinearLayout parent,JSONArray items,boolean ranked,boolean grid){
        LinearLayout row=a.row();row.setGravity(Gravity.BOTTOM);row.setPadding(a.dp(gutter()),grid?0:a.dp(8),a.dp(gutter()),0);
        if(grid)parent.addView(row,new LinearLayout.LayoutParams(-1,-2));else{HorizontalScrollView scroller=new HorizontalScrollView(a);scroller.setHorizontalScrollBarEnabled(false);scroller.setClipToPadding(false);scroller.addView(row);parent.addView(scroller,new LinearLayout.LayoutParams(-1,-2));}
        int limit=ranked?Math.min(10,items.length()):items.length();
        int screen=width();int cols=columns();int gridWidth=(screen-gutter()*2-8*(cols-1))/cols;
        for(int i=0;i<limit;i++){
            JSONObject title=items.optJSONObject(i);if(title==null||title.optInt("id")<1)continue;
            int width=ranked?(i>=9?270:220):grid?gridWidth:280;int height=ranked?190:Math.round(width*9f/16);
            FrameLayout tile=new FrameLayout(a);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(a.dp(width),a.dp(height));lp.setMargins(0,0,i<limit-1?a.dp(8):0,0);row.addView(tile,lp);
            if(ranked){final String number=String.valueOf(i+1);View rank=new View(a){final Paint paint=new Paint(3);@Override protected void onDraw(Canvas canvas){paint.setTypeface(a.font("bebas",400));paint.setTextSize(a.dp(190));paint.setStrokeWidth(a.dp(3));paint.setStyle(Paint.Style.STROKE);paint.setColor(0xff595959);canvas.drawText(number,0,getHeight()-a.dp(3),paint);}};tile.addView(rank,new FrameLayout.LayoutParams(-1,-1));}
            FrameLayout picture=new FrameLayout(a);picture.setBackground(a.shape(SURFACE,5));picture.setClipToOutline(true);FrameLayout.LayoutParams pp=new FrameLayout.LayoutParams(ranked?a.dp(128):-1,-1,Gravity.RIGHT);tile.addView(picture,pp);
            LinearLayout holder=a.column();picture.addView(holder,new FrameLayout.LayoutParams(-1,-1));
            if(ranked?!str(title,"posterUrl").isEmpty():hasArtwork(title)){a.image(holder,artwork(title,ranked?"poster":"card"),height,()->openDetail(title));ImageView image=(ImageView)holder.getChildAt(0);image.setScaleType(ranked?ImageView.ScaleType.FIT_CENTER:ImageView.ScaleType.CENTER_CROP);image.setBackgroundColor(SURFACE);}
            else{TextView fallback=a.text(str(title,"title"),16,MUTED);fallback.setGravity(Gravity.CENTER);fallback.setPadding(a.dp(12),a.dp(12),a.dp(12),a.dp(12));holder.addView(fallback,new LinearLayout.LayoutParams(-1,-1));}
            if(!ranked){
                View shade=new View(a);shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x00000000,0xe6000000}));FrameLayout.LayoutParams shadeLp=new FrameLayout.LayoutParams(-1,a.dp(height*2/3),Gravity.BOTTOM);picture.addView(shade,shadeLp);
                boolean isNew=title.optBoolean("isNew");TextView name=a.text(str(title,"title"),14,WHITE);name.setTypeface(a.font("inter",500));name.setSingleLine(true);name.setEllipsize(android.text.TextUtils.TruncateAt.END);FrameLayout.LayoutParams nameLp=new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);nameLp.setMargins(a.dp(12),0,a.dp(12),a.dp(isNew?29:9));picture.addView(name,nameLp);
                if(isNew){TextView badge=a.text("Yeni Eklendi",12,WHITE);badge.setTypeface(a.font("inter",500));badge.setPadding(a.dp(8),a.dp(2),a.dp(8),a.dp(3));badge.setBackground(a.shape(RED,2));picture.addView(badge,new FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM|Gravity.LEFT));}
                if(!title.isNull("progress")&&title.has("progress")){View track=new View(a);track.setBackgroundColor(0x55ffffff);picture.addView(track,new FrameLayout.LayoutParams(-1,a.dp(3),Gravity.BOTTOM));View filled=new View(a);filled.setBackgroundColor(RED);picture.addView(filled,new FrameLayout.LayoutParams(a.dp((float)(width*Math.max(0,Math.min(1,title.optDouble("progress"))))),a.dp(3),Gravity.BOTTOM));}
            }
            tile.setOnClickListener(v->openDetail(title));picture.setOnClickListener(v->openDetail(title));tile.setContentDescription(str(title,"title"));tile.setOnLongClickListener(v->{a.choose(str(title,"title"),new String[]{"Oynat / Devam et","Ayrıntılar"},choice->{if(choice==0)loadAndPlay(title.optInt("id"),preferredEpisode(title),false);else openDetail(title);});return true;});
        }
    }
    private void progress(LinearLayout parent, double fraction) {
        ProgressBar bar = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        bar.setProgress((int) (Math.max(0, Math.min(1, fraction)) * 1000));
        bar.setProgressTintList(ColorStateList.valueOf(RED));
        bar.setProgressBackgroundTintList(ColorStateList.valueOf(0xff555555));
        bar.setContentDescription("İzlenen: %" + Math.round(Math.max(0, Math.min(1, fraction)) * 100));
        parent.addView(bar, new LinearLayout.LayoutParams(-1, a.dp(5)));
    }

    private void openDetail(JSONObject title) {
        int id = title.optInt("id");
        if (id > 0) a.navigate(() -> detail(id));
    }

    private void detail(int id) {
        LinearLayout parent=page("Yapım ayrıntıları",()->detail(id),-1);
        LinearLayout content=section(parent);int token=epoch;
        pending(content,"Yapım yükleniyor…",()->detail(id));
        a.get(API+"mobile/title/"+id,data->{
            if(token!=epoch)return;content.removeAllViews();
            if(apiError(content,data,()->detail(id)))return;
            JSONObject title=data.optJSONObject("title");
            if(title==null){a.note(content,"Yapım bulunamadı.");return;}
            hero(content,title,true);
            LinearLayout details=width()>=768?a.row():a.column();details.setGravity(Gravity.TOP);
            details.setPadding(a.dp(gutter()),a.dp(24),a.dp(gutter()),0);
            content.addView(details,new LinearLayout.LayoutParams(-1,-2));
            LinearLayout synopsis=a.column(),aside=a.column();
            if(width()>=768){LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(0,-2,1);sp.setMargins(0,0,a.dp(40),0);details.addView(synopsis,sp);details.addView(aside,new LinearLayout.LayoutParams(a.dp(320),-2));}
            else{details.addView(synopsis,new LinearLayout.LayoutParams(-1,-2));LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,-2);fp.setMargins(0,a.dp(40),0,0);details.addView(aside,fp);}
            boolean movie="MOVIE".equals(str(title,"kind"));
            Flow metadata=new Flow(12,12);synopsis.addView(metadata,new LinearLayout.LayoutParams(-1,-2));
            if(title.optBoolean("isNew"))metaLabel(metadata,"Yeni",GREEN,false);
            if(!movie){if(title.optInt("seasons")>0)metaLabel(metadata,title.optInt("seasons")+" Sezon",MUTED,false);metaLabel(metadata,title.optInt("episodeCount")+" Bölüm",MUTED,false);}
            else if(title.optInt("runtime")>0){int minutes=title.optInt("runtime");metaLabel(metadata,(minutes/60)+" sa "+(minutes%60)+" dk",MUTED,false);}
            if(title.optInt("year")>0)metaLabel(metadata,String.valueOf(title.optInt("year")),MUTED,false);
            quality(metadata,str(title,"quality"));
            if(!str(title,"certification").isEmpty()){a.space(synopsis,12);Flow cert=new Flow(0,0);synopsis.addView(cert,new LinearLayout.LayoutParams(-1,-2));metaLabel(cert,str(title,"certification"),0xffe5e5e5,true);}
            LinearLayout ranking=section(synopsis);
            a.get(API+"mobile/home?kind="+str(title,"kind"),home->{
                if(token!=epoch)return;JSONArray top=array(home,"topRated");
                for(int i=0;i<Math.min(10,top.length());i++)if(top.optJSONObject(i)!=null&&top.optJSONObject(i).optInt("id")==id){
                    a.space(ranking,16);LinearLayout row=a.row();TextView badge=a.text("TOP\n10",12,WHITE);badge.setGravity(Gravity.CENTER);badge.setBackground(a.shape(RED,4));row.addView(badge,new LinearLayout.LayoutParams(a.dp(36),a.dp(36)));
                    TextView rank=a.text(singular(str(title,"kind"))+" kategorisinde #"+(i+1),20,WHITE);rank.setTypeface(a.font("inter",500));LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(0,-2,1);rp.setMargins(a.dp(12),0,0,0);row.addView(rank,rp);ranking.addView(row);break;}
            });
            if(title.optDouble("rating",0)>0){a.space(synopsis,12);label(synopsis,String.format(Locale.forLanguageTag("tr"),"Puan: %.1f / 10",title.optDouble("rating")),16,MUTED);}
            a.space(synopsis,20);TextView overview=a.text(fallback(str(title,"overview"),"Bu başlık için henüz özet bulunamadı."),18,0xffe5e5e5);overview.setLineSpacing(0,28f/18);synopsis.addView(overview);
            facts(aside,"Oyuncular",array(title,"cast"));facts(aside,"Türler",array(title,"genres"));facts(aside,"Bu yapım",array(title,"moods"));
            JSONArray episodes=array(data,"episodes");
            if(!movie&&episodes.length()>0)episodeList(content,title,episodes);
            if(array(data,"similar").length()>0){a.space(content,40);titleRow(content,"Benzer Yapımlar",array(data,"similar"),false);}
        });
    }

    private void titleActions(LinearLayout parent,JSONObject title) {
        int token=epoch,id=title.optInt("id");a.space(parent,16);
        Flow actions=new Flow(12,12);parent.addView(actions,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout editor=a.column();editor.setPadding(a.dp(16),a.dp(16),a.dp(16),a.dp(16));editor.setBackground(a.shape(0xe6000000,4));
        LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(a.dp(Math.min(576,width()-gutter()*2)),-2);ep.topMargin=a.dp(12);parent.addView(editor,ep);editor.setVisibility(View.GONE);
        TextView status=a.text("",14,WHITE);parent.addView(status);status.setVisibility(View.GONE);
        ArrayList<View> locked=new ArrayList<>();
        TextView reset=actionButton(actions,"İzlenmedi olarak işaretle");locked.add(reset);
        reset.setOnClickListener(v->titleRequest("DELETE",API+"progress",a.obj("titleId",id),locked,status,result->{a.toast("İzlenmedi olarak işaretlendi");detail(id);}));
        if(!"MOVIE".equals(str(title,"kind")))return;
        TextView match=actionButton(actions,"Film eşleşmesini düzelt");
        match.setOnClickListener(v->editor.setVisibility(editor.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE));
        LinearLayout form=a.row();editor.addView(form);EditText query=new EditText(a);query.setSingleLine(true);query.setText(str(title,"title"));query.setTextSize(16);query.setTextColor(WHITE);query.setContentDescription("Film adı");query.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(200)});query.setPadding(a.dp(8),a.dp(8),a.dp(8),a.dp(8));query.setBackground(a.shape(0x1affffff,4));form.addView(query,new LinearLayout.LayoutParams(0,a.dp(44),1));
        TextView search=actionButton(form,"Ara");search.setBackground(a.shape(RED,4));LinearLayout.LayoutParams searchParams=new LinearLayout.LayoutParams(-2,a.dp(44));searchParams.leftMargin=a.dp(8);search.setLayoutParams(searchParams);locked.add(search);
        LinearLayout results=a.column();android.widget.ScrollView scroll=new android.widget.ScrollView(a){@Override protected void onMeasure(int w,int h){super.onMeasure(w,View.MeasureSpec.makeMeasureSpec(a.dp(320),View.MeasureSpec.AT_MOST));}};scroll.addView(results);LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.topMargin=a.dp(12);editor.addView(scroll,rp);scroll.setVisibility(View.GONE);
        Runnable find=()->{String q=query.getText().toString().trim();if(q.isEmpty()){query.setError("Film adı girin");return;}results.removeAllViews();scroll.setVisibility(View.GONE);
            titleRequest("GET",API+"metadata/"+id+"?q="+a.enc(q),null,locked,status,data->{
                if(token!=epoch)return;JSONArray items=array(data,"results");status.setText(items.length()==0?"Sonuç bulunamadı":"");status.setVisibility(items.length()==0?View.VISIBLE:View.GONE);scroll.setVisibility(items.length()>0?View.VISIBLE:View.GONE);
                for(int i=0;i<items.length();i++){JSONObject item=items.optJSONObject(i);if(item==null)continue;
                    LinearLayout row=a.row();row.setPadding(a.dp(8),a.dp(8),a.dp(8),a.dp(8));row.setMinimumHeight(a.dp(96));results.addView(row,new LinearLayout.LayoutParams(-1,-2));
                    if(!str(item,"posterUrl").isEmpty()){ImageView poster=new ImageView(a);poster.setScaleType(ImageView.ScaleType.CENTER_CROP);row.addView(poster,new LinearLayout.LayoutParams(a.dp(56),a.dp(80)));a.api.image(str(item,"posterUrl"),240,poster::setImageBitmap);}
                    LinearLayout copy=a.column();copy.setPadding(a.dp(12),0,0,0);row.addView(copy,new LinearLayout.LayoutParams(0,-2,1));label(copy,str(item,"title")+(item.optInt("year")>0?" ("+item.optInt("year")+")":""),16,WHITE);label(copy,str(item,"originalTitle"),13,0xffd1d5db);
                    row.setContentDescription(str(item,"title")+" · "+item.optInt("year"));locked.add(row);
                    row.setOnClickListener(v->titleRequest("POST",API+"metadata/"+id,a.obj("tmdbId",item.optInt("id")),locked,status,saved->{a.toast("Film bilgileri güncellendi");detail(id);}));
                }
            });};search.setOnClickListener(v->find.run());query.setImeOptions(EditorInfo.IME_ACTION_SEARCH);query.setOnEditorActionListener((v,action,event)->{if(action==EditorInfo.IME_ACTION_SEARCH&&search.isEnabled()){find.run();return true;}return false;});
    }

    private TextView actionButton(ViewGroup parent,String text){TextView button=a.text(text,16,WHITE);button.setPadding(a.dp(16),a.dp(8),a.dp(16),a.dp(8));button.setGravity(Gravity.CENTER);button.setBackground(a.shape(0x1affffff,4));button.setContentDescription(text);parent.addView(button,new ViewGroup.LayoutParams(-2,-2));return button;}

    private void titleRequest(String method,String path,JSONObject body,List<View> locked,TextView status,Consumer<JSONObject> done){
        int token=epoch;for(View v:locked){v.setEnabled(false);v.setAlpha(.5f);}status.setText("Yükleniyor…");status.setVisibility(View.VISIBLE);
        a.api.io.execute(()->{JSONObject result=null;String error=null;try{result=(JSONObject)a.api.sync(method,path,body);}catch(Exception e){error=e.getMessage();}JSONObject response=result;String failure=error;
            main.post(()->{if(token!=epoch||a.isDestroyed())return;for(View v:locked){v.setEnabled(true);v.setAlpha(1);}status.setText(failure==null?"":failure);status.setVisibility(failure==null?View.GONE:View.VISIBLE);if(failure==null)done.accept(response);});});
    }

    private void facts(LinearLayout parent, String name, JSONArray values) {
        if (values.length() > 0) label(parent, name + ": " + String.join(", ", strings(values)), 14, MUTED);
    }

    private void episodeList(LinearLayout parent, JSONObject title, JSONArray episodes) {
        LinearLayout headerRow=a.row();headerRow.setPadding(a.dp(gutter()),a.dp(40),a.dp(gutter()),a.dp(16));TextView headerTitle=a.text("Bölümler",24,WHITE);headerTitle.setTypeface(a.font("inter",500));headerRow.addView(headerTitle,new LinearLayout.LayoutParams(0,-2,1));parent.addView(headerRow);
        Set<Integer> seasonSet = new TreeSet<>();
        for (int i = 0; i < episodes.length(); i++) {
            JSONObject episode = episodes.optJSONObject(i);
            if (episode == null) continue;
            seasonSet.add(episode.optInt("season", 1));
        }
        if (seasonSet.isEmpty()) return;
        List<Integer> seasons = new ArrayList<>(seasonSet);
        String[] options = new String[seasons.size()];
        for (int i = 0; i < seasons.size(); i++) options[i] = seasons.get(i) == 0 ? "Özel Bölümler" : seasons.get(i) + ". Sezon";
        LinearLayout selector = a.column();headerRow.addView(selector);
        LinearLayout list = section(parent);list.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);
        int initial = Math.max(0, seasons.indexOf(selectedSeasons.get(title.optInt("id"))));
        Consumer<Integer> draw = new Consumer<Integer>() {
            @Override public void accept(Integer selected) {
                selectedSeasons.put(title.optInt("id"),seasons.get(selected));
                selector.removeAllViews();
                if(options.length>1){TextView drop=a.text(options[selected]+"  ⌄",14,WHITE);drop.setPadding(a.dp(10),a.dp(8),a.dp(10),a.dp(8));drop.setBackground(Ui.border(a,SURFACE,0x55ffffff,5));selector.addView(drop);drop.setOnClickListener(v->a.choose("Sezon",options,this::accept));}
                list.removeAllViews();
                Ui.line(a,list,0x22ffffff);
                for (int i = 0; i < episodes.length(); i++) {
                    JSONObject episode = episodes.optJSONObject(i);
                    if (episode == null || episode.optInt("season", 1) != seasons.get(selected)) continue;
                    LinearLayout card=a.row();card.setPadding(a.dp(16),a.dp(16),a.dp(16),a.dp(16));list.addView(card);
                    TextView number=a.text(String.valueOf(episode.optInt("number",1)),24,0xff808080);number.setGravity(Gravity.CENTER);card.addView(number,new LinearLayout.LayoutParams(a.dp(40),-2));
                    LinearLayout info=a.column();info.setPadding(a.dp(20),0,a.dp(20),0);card.addView(info,new LinearLayout.LayoutParams(0,-2,1));TextView name=a.text(fallback(str(episode,"name"),episode.optInt("number",1)+". Bölüm"),16,WHITE);name.setTypeface(a.font("inter",500));name.setSingleLine(true);name.setEllipsize(android.text.TextUtils.TruncateAt.END);info.addView(name);
                    double seconds = safeSeconds(episode.optDouble("seconds", 0));
                    double duration = safeSeconds(episode.optDouble("duration", 0));
                    if (seconds > 0) {
                        a.space(info,8);LinearLayout track=a.column();info.addView(track,new LinearLayout.LayoutParams(a.dp(Math.min(192,Math.max(32,width()-gutter()*2-188))),-2));progress(track,duration>0?seconds/duration:0);
                    }
                    if(!str(episode,"quality").isEmpty())metaLabel(card,str(episode,"quality").replace("+HDR",""),WHITE,true);
                    View play=Ui.icon(a,"play",36,WHITE,()->loadAndPlay(title.optInt("id"),episode.optInt("id"),false));play.setBackground(Ui.border(a,0x442a2a2a,0x88ffffff,36));card.addView(play);
                    card.setOnClickListener(v -> loadAndPlay(title.optInt("id"), episode.optInt("id"), false));
                    card.setOnLongClickListener(v->{a.choose(episodeLabel(episode),new String[]{"Oynat / Devam et","Baştan oynat"},choice->loadAndPlay(title.optInt("id"),episode.optInt("id"),choice==1));return true;});Ui.line(a,list,0x22ffffff);
                }
            }
        };
        draw.accept(initial);
    }

    private void loadAndPlay(int titleId, int episodeId, boolean fromStart) { loadAndPlay(titleId,episodeId,fromStart,false); }
    private void loadAndPlay(int titleId, int episodeId, boolean fromStart, boolean replace) {
        if (titleId < 1 || episodeId < 1) { a.toast("Oynatılabilir bölüm bulunamadı."); return; }
        int token = epoch;
        a.toast("Oynatıcı hazırlanıyor…");
        // Refresh immediately before playing: home/search DTOs intentionally do
        // not carry seconds, and returning from the player may change progress.
        a.api.playbackRequest(API + "mobile/title/" + titleId, data -> {
            if (token != epoch) return;
            JSONObject title = data.optJSONObject("title");
            if (title == null) { a.toast("Yapım artık mevcut değil."); return; }
            JSONArray episodes = array(data, "episodes");
            for (int i = 0; i < episodes.length(); i++) {
                JSONObject episode = episodes.optJSONObject(i);
                if (episode == null || episode.optInt("id") != episodeId) continue;
                double seconds = safeSeconds(episode.optDouble("seconds", 0));
                double duration = safeSeconds(episode.optDouble("duration", 0));
                double start = !fromStart && seconds > 5 && (duration <= 0 || seconds < duration - 30) ? seconds : 0;
                int previousId = i > 0 && episodes.optJSONObject(i - 1) != null ? episodes.optJSONObject(i - 1).optInt("id") : 0;
                int nextId = i + 1 < episodes.length() && episodes.optJSONObject(i + 1) != null
                        ? episodes.optJSONObject(i + 1).optInt("id") : 0;
                String name = str(title, "title");
                if (!"MOVIE".equals(str(title, "kind"))) name += " · " + episodeLabel(episode);
                a.play(API + "stream/" + episodeId, name, start, API + "progress", episodeId,
                        previousId > 0 ? () -> loadAndPlay(titleId, previousId, false, true) : null,
                        nextId > 0 ? () -> loadAndPlay(titleId, nextId, false, true) : null, replace);
                return;
            }
            a.toast("Bölüm bulunamadı; kütüphaneyi yenile.");
        });
    }

    private void search(String query,String selectedKind) {
        LinearLayout parent=page("“"+query+"” için sonuçlar",()->search(query,selectedKind),-1);
        pageTitle(parent,"“"+query+"” için sonuçlar");
        if(query.isEmpty()){TextView hint=label(parent,"Eşleşen başlık bulunamadı.",16,0xff808080);hint.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);return;}
        LinearLayout results=section(parent);pending(results,"Aranıyor…",()->search(query,selectedKind));int token=epoch;
        a.get(API+"mobile/search?q="+a.enc(query)+(selectedKind.isEmpty()?"":"&kind="+selectedKind),data->{
            if(token!=epoch)return;results.removeAllViews();if(apiError(results,data,()->search(query,selectedKind)))return;
            JSONArray items=array(data,"items");if(items.length()==0){TextView empty=label(results,"Eşleşen başlık bulunamadı.",16,0xff808080);empty.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);return;}
            collection(results,objects(items),"",false);
        });
    }

    private void pageTitle(LinearLayout parent,String value) {
        TextView title=a.text(value,28,WHITE);title.setTypeface(a.font("inter",500));title.setLineSpacing(0,1.5f);
        title.setPadding(a.dp(gutter()),a.dp(8),a.dp(gutter()),a.dp(24));parent.addView(title,new LinearLayout.LayoutParams(-1,-2));
    }

    private void catalogue(String selectedKind, String genre) {
        LinearLayout parent = page(genre.isEmpty() ? "Tüm Yapımlar" : genre,
                () -> catalogue(selectedKind, genre), kindIndex(selectedKind));
        a.chips(parent, new String[]{"Tümü", "Diziler", "Filmler", "Animeler"}, kindIndex(selectedKind),
                index -> catalogue(KINDS[index], genre));
        LinearLayout content = section(parent);
        if (!selectedKind.isEmpty()) loadIndex(content, route(selectedKind), selectedKind, genre, false);
        else {
            // Each category page contains its complete alphabetic catalogue.
            List<JSONObject> all = new ArrayList<>();
            int[] left = {3};
            int token = epoch;
            pending(content, "Katalog yükleniyor…", () -> catalogue(selectedKind, genre));
            for (int i = 1; i < KINDS.length; i++) {
                String k = KINDS[i];
                readIndex(route(k), token, content, ids -> hydrate(ids, token, content, items -> {
                    all.addAll(items);
                    if (--left[0] == 0) {
                        content.removeAllViews();
                        collection(content, all, genre, false);
                    }
                }));
            }
        }
    }

    private void myList() {
        LinearLayout parent = page("Daha sonra izlemek istediklerin", this::myList, 4);
        pageTitle(parent,"Listem");
        loadIndex(section(parent), "/keremflix/listem", "", "", true);
    }

    private void loadIndex(LinearLayout area, String path, String selectedKind, String genre, boolean list) {
        // A fresh container invalidates any in-flight index attempt after retry.
        area.removeAllViews();
        LinearLayout attempt = section(area);
        int token = epoch;
        pending(attempt, list ? "Listen yükleniyor…" : "Katalog yükleniyor…",
                () -> { area.removeAllViews(); loadIndex(area, path, selectedKind, genre, list); });
        readIndex(path, token, attempt, ids -> hydrate(ids, token, attempt, items -> {
            if (!current(token, attempt)) return;
            area.removeAllViews();
            if (items.isEmpty()) {
                TextView empty=label(area,list?"Listen boş. Bir başlığın üzerindeki + simgesine tıklayarak ekleyebilirsin.":"Bu kategoride henüz yapım yok.",16,0xff808080);empty.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);
                return;
            }
            if(!selectedKind.isEmpty())items.sort((x,y)->java.text.Collator.getInstance(Locale.forLanguageTag("tr")).compare(str(x,"title"),str(y,"title")));
            collection(area, items, genre, list);
        }));
    }

    /** Read-only HTML index adapter, because no equivalent JSON GET exists. */
    private void readIndex(String path, int token, LinearLayout area, Consumer<List<Integer>> done) {
        String origin = a.base().replaceAll("/+$", "");
        Thread reader = new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(origin + path).openConnection();
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(30000);
                connection.setRequestProperty("Accept", "text/html");
                connection.setRequestProperty("User-Agent", "Keremhub-Android/1.0");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new java.io.IOException("HTTP " + status);
                String html;
                try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                    html = new String(output.toByteArray(), StandardCharsets.UTF_8);
                }
                // An unexpected login/proxy page must not masquerade as an empty library.
                if (!html.contains("KEREMFLIX") && !html.toLowerCase(Locale.ROOT).contains("keremflix"))
                    throw new java.io.IOException("Sunucu Keremflix kataloğunu döndürmedi.");
                Set<Integer> unique = new LinkedHashSet<>();
                Matcher matcher = TITLE_LINK.matcher(html);
                while (matcher.find()) {
                    try { int id = Integer.parseInt(matcher.group(1)); if (id > 0) unique.add(id); }
                    catch (NumberFormatException ignored) { }
                }
                List<Integer> ids = new ArrayList<>(unique);
                main.post(() -> { if (current(token, area)) done.accept(ids); });
            } catch (Exception error) {
                String message = fallback(error.getMessage(), "Bağlantı kurulamadı");
                main.post(() -> {
                    if (!current(token, area)) return;
                    area.removeAllViews();
                    a.note(area, "Katalog yüklenemedi: " + message);
                    action(area, "Tekrar dene", () -> {
                        area.removeAllViews();
                        pending(area, "Katalog yükleniyor…", () -> readIndex(path, token, area, done));
                        readIndex(path, token, area, done);
                    }, false);
                });
            } finally { if (connection != null) connection.disconnect(); }
        }, "Keremflix-index");
        reader.setDaemon(true);
        reader.start();
    }

    /** Limit concurrent detail reads and retain source order, including Listem order. */
    private void hydrate(List<Integer> ids, int token, LinearLayout area, Consumer<List<JSONObject>> done) {
        if (ids.isEmpty()) { done.accept(new ArrayList<>()); return; }
        JSONObject[] titles = new JSONObject[ids.size()];
        int[] cursor = {0}, completed = {0};
        boolean[] abandoned = {false};
        TextView status = label(area, "0 / " + ids.size() + " yapım", 13, MUTED);
        Runnable[] pump = new Runnable[1];
        pump[0] = () -> {
            if (abandoned[0] || !current(token, area) || cursor[0] >= ids.size()) return;
            int index = cursor[0]++;
            a.get(API + "mobile/title/" + ids.get(index), detail -> {
                if (abandoned[0] || !current(token, area)) return;
                JSONObject title = detail.optJSONObject("title");
                if (title == null) {
                    label(area, "Bir yapım yüklenemedi. Kataloğu yenileyerek tekrar dene.", 13, MUTED);
                    return;
                }
                titles[index] = title;
                completed[0]++;
                status.setText(completed[0] + " / " + ids.size() + " yapım");
                if (completed[0] == ids.size()) {
                    List<JSONObject> result = new ArrayList<>();
                    Collections.addAll(result, titles);
                    done.accept(result);
                } else pump[0].run();
            });
        };
        for (int i = 0; i < Math.min(4, ids.size()); i++) pump[0].run();
        // Four failed requests would otherwise leave this loader waiting forever.
        // Keep the full index intact and offer retry rather than an incomplete list.
        main.postDelayed(new Runnable() {
            int previous = -1;
            @Override public void run() {
                if (!current(token, area) || completed[0] == ids.size() || abandoned[0]) return;
                if (previous == completed[0]) {
                    abandoned[0] = true;
                    a.note(area, "Bazı yapımlar alınamadı. Bağlantıyı kontrol edip kataloğu yeniden yükle.");
                    action(area, "Yüklemeyi Tekrar Dene", () -> {
                        area.removeAllViews();
                        hydrate(ids, token, area, done);
                    }, false);
                    return;
                }
                previous = completed[0];
                main.postDelayed(this, 35000);
            }
        }, 35000);
    }

    private void collection(LinearLayout parent,List<JSONObject> source,String initialGenre,boolean list) {
        LinkedHashMap<Integer,JSONObject> unique=new LinkedHashMap<>();
        for(JSONObject item:source)if(item!=null&&item.optInt("id")>0&&(initialGenre.isEmpty()||contains(array(item,"genres"),initialGenre)))unique.put(item.optInt("id"),item);
        List<JSONObject> items=new ArrayList<>(unique.values());
        if(items.isEmpty()){TextView empty=label(parent,list?"Listen boş. Bir başlığın üzerindeki + simgesine tıklayarak ekleyebilirsin.":"Bu türde yapım bulunamadı.",16,0xff808080);empty.setPadding(a.dp(gutter()),0,a.dp(gutter()),0);return;}
        int count=columns();
        for(int i=0;i<items.size();i+=count){JSONArray row=new JSONArray();for(int j=i;j<Math.min(i+count,items.size());j++)row.put(items.get(j));cards(parent,row,false,true);a.space(parent,8);}
    }

    private void scanOptions() {
        if (scanBusy) { a.toast("Tarama zaten sürüyor."); return; }
        a.choose("Kütüphaneyi Tara", new String[]{"Yeni dosyaları tara", "Dosyaları tara ve eksik bilgileri tamamla"}, option -> {
            a.confirm("Kütüphaneyi Tara", "Sunucudaki medya klasörleri taranacak; diskte olmayan bölümler kütüphaneden kaldırılacak."
                    + (option == 1 ? " Eksik yapım bilgileri tekrar aranacak." : ""), () -> scan(option == 1));
        });
    }

    private void scan(boolean refetch) {
        scanBusy = true;
        int token = epoch;
        LinearLayout status = a.card(body);
        label(status, "Kütüphane taranıyor…", 16, WHITE);
        a.note(status, "Büyük kütüphanelerde işlem birkaç dakika sürebilir. Sonuç gelene kadar yeniden başlatma.");
        a.toast("Tarama başlatıldı");
        // The scanner explicitly allows 300 seconds; the shared JSON transport
        // has a shorter general-purpose timeout. Keep this request off the UI
        // thread with its own timeout so the actual scan result can be shown.
        requestScan(refetch, result -> {
            scanBusy = false;
            if (!current(token, status)) return;
            status.removeAllViews();
            if (apiError(status, result, this::scanOptions)) return;
            if (!result.has("titles") || !result.has("episodes")) {
                a.note(status, "Tarama sonucu doğrulanamadı. Kütüphaneyi yenileyerek durumunu kontrol et."); return;
            }
            label(status, "Tarama tamamlandı", 18, GREEN);
            a.note(status, result.optInt("titles") + " yapım · " + result.optInt("episodes") + " bölüm\n"
                    + result.optInt("newTitles") + " yeni yapım · " + result.optInt("removed") + " kaldırılan bölüm\n"
                    + result.optInt("metaFetched") + " bilgi tamamlandı · " + result.optInt("metaMissing") + " eksik bilgi");
            action(status, "Kütüphaneyi Yenile", () -> browse(kind), true);
        }, message -> {
            scanBusy = false;
            if (!current(token, status)) return;
            status.removeAllViews();
            a.note(status, "Tarama sonucu alınamadı: " + message
                    + "\nSunucudaki işlem devam ediyor olabilir. Kütüphaneyi yenileyerek kontrol et.");
            action(status, "Kütüphaneyi Yenile", () -> browse(kind), false);
        });
    }

    private void requestScan(boolean refetch, Consumer<JSONObject> done, Consumer<String> failure) {
        String address = a.base().replaceAll("/+$", "") + API + "scan" + (refetch ? "?refetch=1" : "");
        Thread worker = new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(address);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(330000);
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("User-Agent", "Keremhub-Android/1.0");
                String origin = url.getProtocol() + "://" + url.getAuthority();
                connection.setRequestProperty("Origin", origin);
                connection.setRequestProperty("Referer", origin + "/keremflix/");
                connection.setDoOutput(true);
                try (java.io.OutputStream output = connection.getOutputStream()) {
                    output.write("{}".getBytes(StandardCharsets.UTF_8));
                }
                int code = connection.getResponseCode();
                InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String response = "";
                if (stream != null) {
                    try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[4096]; int length;
                        while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
                        response = new String(output.toByteArray(), StandardCharsets.UTF_8);
                    }
                }
                JSONObject result;
                try { result = new JSONObject(response); }
                catch (Exception malformed) { throw new java.io.IOException("Geçersiz sunucu yanıtı (HTTP " + code + ")"); }
                if (code < 200 || code >= 300)
                    throw new java.io.IOException(fallback(str(result, "error"), "HTTP " + code));
                main.post(() -> { if (!a.isDestroyed()) done.accept(result); });
            } catch (Exception error) {
                String message = fallback(error.getMessage(), "Bağlantı kesildi");
                main.post(() -> { if (!a.isDestroyed()) failure.accept(message); });
            } finally { if (connection != null) connection.disconnect(); }
        }, "Keremflix-scan");
        worker.setDaemon(true);
        worker.start();
    }

    private boolean apiError(LinearLayout parent, JSONObject data, Runnable retry) {
        if (!data.has("error")) return false;
        a.note(parent, fallback(str(data, "error"), "İstek tamamlanamadı."));
        action(parent, "Tekrar dene", retry, false);
        return true;
    }

    private static JSONArray array(JSONObject object, String key) {
        JSONArray result = object.optJSONArray(key);
        return result == null ? new JSONArray() : result;
    }
    private static JSONArray first(JSONArray source,int limit) {
        JSONArray result=new JSONArray();for(int i=0;i<Math.min(limit,source.length());i++)result.put(source.opt(i));return result;
    }
    private static String str(JSONObject object, String key) {
        return object == null || object.isNull(key) ? "" : object.optString(key, "");
    }
    private static String fallback(String value, String fallback) { return value.isEmpty() ? fallback : value; }
    private static List<JSONObject> objects(JSONArray array) {
        List<JSONObject> result = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) if (array.optJSONObject(i) != null) result.add(array.optJSONObject(i));
        return result;
    }
    private static String[] strings(JSONArray array) {
        List<String> result = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) if (!array.isNull(i) && !array.optString(i).isEmpty()) result.add(array.optString(i));
        return result.toArray(new String[0]);
    }
    private static boolean contains(JSONArray array, String value) {
        for (int i = 0; i < array.length(); i++) if (value.equals(array.optString(i))) return true;
        return false;
    }
    private static int preferredEpisode(JSONObject title) {
        int resume = title.optInt("resumeEpisodeId", 0);
        return resume > 0 ? resume : title.optInt("firstEpisodeId", 0);
    }
    private static String plural(String kind) { return "SERIES".equals(kind) ? "Diziler" : "ANIME".equals(kind) ? "Animeler" : "Filmler"; }
    private static String singular(String kind) { return "SERIES".equals(kind) ? "Dizi" : "ANIME".equals(kind) ? "Anime" : "Film"; }
    private static String route(String kind) { return "/keremflix/" + ("SERIES".equals(kind) ? "dizi" : "ANIME".equals(kind) ? "anime" : "film"); }
    private static int kindIndex(String kind) { for (int i = 0; i < KINDS.length; i++) if (KINDS[i].equals(kind)) return i; return 0; }
    private static boolean hasArtwork(JSONObject title) { return !str(title, "posterUrl").isEmpty() || !str(title, "backdropUrl").isEmpty(); }
    private static String artwork(JSONObject title, String role) {
        // Same unsigned DJB2-XOR cache version as artwork-url.ts (source URLs can be null).
        String source = (title.isNull("posterUrl") ? "null" : str(title, "posterUrl")) + "|"
                + (title.isNull("backdropUrl") ? "null" : str(title, "backdropUrl"));
        int hash = 5381;
        for (int offset = 0; offset < source.length();) {
            int codePoint = source.codePointAt(offset);
            hash = hash * 33 ^ source.charAt(offset);
            offset += Character.charCount(codePoint);
        }
        return API + "artwork/" + title.optInt("id") + "/" + role + "?v=1-" + Integer.toHexString(hash);
    }
    private static String compactMeta(JSONObject title) {
        List<String> parts = new ArrayList<>();
        if (title.optInt("year") > 0) parts.add(String.valueOf(title.optInt("year")));
        if (!str(title, "quality").isEmpty()) parts.add(str(title, "quality").replace("+", " · "));
        if (!str(title, "certification").isEmpty()) parts.add(str(title, "certification"));
        return String.join(" · ", parts);
    }
    private static String meta(JSONObject title) {
        List<String> parts = new ArrayList<>();
        String compact = compactMeta(title);
        if (!compact.isEmpty()) parts.add(compact);
        if ("MOVIE".equals(str(title, "kind"))) {
            if (title.optInt("runtime") > 0) parts.add(title.optInt("runtime") + " dk");
        } else {
            if (title.optInt("seasons") > 0) parts.add(title.optInt("seasons") + " sezon");
            parts.add(title.optInt("episodeCount") + " bölüm");
        }
        return String.join(" · ", parts);
    }
    private static String episodeLabel(JSONObject episode) {
        String name = str(episode, "name");
        return episode.optInt("season", 1) + ". Sezon · " + episode.optInt("number", 1) + ". Bölüm"
                + (name.isEmpty() ? "" : " · " + name);
    }
    private static double safeSeconds(double value) { return Double.isFinite(value) ? Math.max(0, value) : 0; }
    private static String time(double seconds) {
        long value = (long) safeSeconds(seconds);
        return value >= 3600 ? String.format(Locale.ROOT, "%d:%02d:%02d", value / 3600, value / 60 % 60, value % 60)
                : String.format(Locale.ROOT, "%d:%02d", value / 60, value % 60);
    }
}
