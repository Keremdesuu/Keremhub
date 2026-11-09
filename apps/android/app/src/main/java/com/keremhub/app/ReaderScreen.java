package com.keremhub.app;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.text.Html;
import android.text.Layout;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.method.LinkMovementMethod;
import android.text.style.ClickableSpan;
import android.text.style.URLSpan;
import android.view.View;
import android.view.MotionEvent;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.charset.Charset;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** SDK-only reader. Server EPUB locators are actual OPF-relative hrefs, never synthetic CFIs.
 * Native text offsets and PDF positions are intentionally local to this renderer. */
public final class ReaderScreen {
    private ReaderScreen() {}
    public static void show(MainActivity a, JSONObject detail) { new Session(a, detail).open(); }
    public static void pdf(MainActivity a,String path,String title) { show(a,a.obj("id",0,"format","PDF","title",title,"_filePath",path)); }

    private static final int MAX_XML = 4 * 1024 * 1024, MAX_CHAPTER = 8 * 1024 * 1024;
    private static final long MAX_DOWNLOAD = 512L * 1024 * 1024;
    private static final class Chapter {
        final String path, href;
        String label;
        Chapter(String path, String href) { this.path=path; this.href=href; this.label=href; }
    }
    private static final class Nav {
        final String label, path;
        Nav(String label, String path) { this.label=label; this.path=path; }
    }

    private static final class Session {
        final MainActivity a;
        final JSONObject detail;
        final long id;
        final String format, root, filePath, progressPath, key;
        final SharedPreferences prefs;
        // A private serial queue guarantees renderer/ZIP close cannot race an open page/read.
        final ExecutorService worker = Executors.newSingleThreadExecutor();
        final ArrayList<Chapter> chapters = new ArrayList<>();
        final ArrayList<Nav> navigation = new ArrayList<>();
        volatile boolean closed;
        volatile HttpURLConnection downloading;
        int generation, index, count, font, theme, offset;
        double[] chapterStarts;
        volatile int revision;
        boolean ready, changing, interacted, scrolled, reachedEnd;
        long localTime;
        String serverLocation="", location="";
        double initialPercent;
        LinearLayout body, controls;
        ScrollView viewport;
        TextView content, status, sync;
        ImageView picture;
        SeekBar seek;
        Bitmap bitmap;
        final ArrayList<Bitmap> rasterBitmaps=new ArrayList<>();
        File file;
        ParcelFileDescriptor descriptor;
        PdfRenderer pdf;
        ZipFile zip;
        String opfPath;
        Map<String,Integer> anchors=Collections.emptyMap();
        final Runnable save = () -> { if (alive() && ready && interacted) saveServer(); };
        final Runnable watch = new Runnable() {
            @Override public void run() {
                if (!alive()) { close(); return; }
                a.api.main.postDelayed(this, 500);
            }
        };

        Session(MainActivity a, JSONObject detail) {
            this.a=a; this.detail=detail;
            id=detail.optLong("id",0);
            format=detail.optString("format", "").toLowerCase(Locale.ROOT);
            root="/keremkitabevi/api/books/"+id;
            filePath=detail.optString("_filePath",root+"/file"); progressPath=root+"/progress";
            key=a.api.url(filePath);
            prefs=a.getSharedPreferences("native-book-reader",Context.MODE_PRIVATE);
            font=clamp(prefs.getInt("font",110),70,220);
            theme=clamp(prefs.getInt("theme",0),0,2);
            scrolled=prefs.getBoolean("scrolled",false);
            JSONObject progress=detail.optJSONObject("progress");
            if(progress!=null) {
                serverLocation=progress.optString("location","");
                initialPercent=unit(progress.optDouble("percent",0));
            }
        }

        void open() {
            a.theme(0xff0c1022,0xff141a33,0xffe9ecfa,0xff8e97c2,0xff7a8cff);
            a.page(detail.optString("title","Okuyucu"),"");
            generation=a.generation;
            a.remember(() -> show(a,detail));
            a.onPageCleanup(this::close);
            a.root.getChildAt(0).setVisibility(View.GONE);a.root.removeView(a.scroll);
            body=a.column();a.body=body;a.root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
            controls=a.row();controls.setPadding(a.dp(4),a.dp(4),a.dp(4),a.dp(4));body.addView(controls);
            tool(controls,"‹","Kitap sayfasına dön",a::back);
            LinearLayout caption=a.column();controls.addView(caption,new LinearLayout.LayoutParams(0,-2,1));
            TextView title=a.text(detail.optString("title","Okuyucu"),14,a.ink);title.setTypeface(a.font("bricolage",500));title.setSingleLine(true);title.setEllipsize(android.text.TextUtils.TruncateAt.END);caption.addView(title);
            status=a.text("Kitap indiriliyor…",11,a.muted);status.setSingleLine(true);status.setEllipsize(android.text.TextUtils.TruncateAt.END);caption.addView(status);
            tool(controls,isPdf()?"#":"☷",isPdf()?"Sayfaya git":"İçindekiler",isPdf()?this::goDialog:this::toc);
            tool(controls,"⋮","Okuma seçenekleri",this::options);
            sync=a.text("",11,a.muted);sync.setSingleLine(true);sync.setEllipsize(android.text.TextUtils.TruncateAt.END);sync.setPadding(a.dp(12),0,a.dp(12),0);sync.setVisibility(View.GONE);body.addView(sync);
            viewport=new ScrollView(a); viewport.setFillViewport(false);
            viewport.addOnLayoutChangeListener((view,l,t,r,b,ol,ot,or,ob)->{
                if(ready&&or>ol&&r-l!=or-ol){
                    int at=currentOffset();
                    view.post(()->{if(alive()&&ready)display(index,at,"");});
                }
            });
            viewport.setSaveEnabled(false);
            viewport.setOnTouchListener(new View.OnTouchListener(){
                float downX,downY;
                public boolean onTouch(View v,MotionEvent event){
                    if(scrolled||isPdf()||!ready)return false;
                    if(event.getActionMasked()==MotionEvent.ACTION_DOWN){downX=event.getX();downY=event.getY();return true;}
                    if(event.getActionMasked()==MotionEvent.ACTION_UP){float dx=downX-event.getX(),dy=downY-event.getY();if(Math.max(Math.abs(dx),Math.abs(dy))>a.dp(32))step((Math.abs(dx)>Math.abs(dy)?dx:dy)>0?1:-1);v.performClick();return true;}
                    return true;
                }
            });
            body.addView(viewport,new LinearLayout.LayoutParams(-1,0,1));
            LinearLayout footer=a.row();footer.setPadding(a.dp(4),0,a.dp(4),0);body.addView(footer);
            tool(footer,"‹","Önceki sayfa",()->step(-1));
            seek=new SeekBar(a);seek.setMax(1000);seek.setContentDescription("Kitapta konum");seek.setProgressTintList(android.content.res.ColorStateList.valueOf(0xffffb547));seek.setThumbTintList(android.content.res.ColorStateList.valueOf(0xffffb547));footer.addView(seek,new LinearLayout.LayoutParams(0,a.dp(44),1));
            tool(footer,"›","Sonraki sayfa",()->step(1));
            seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){
                public void onProgressChanged(SeekBar v,int p,boolean user){}
                public void onStartTrackingTouch(SeekBar v){}
                public void onStopTrackingTouch(SeekBar v){if(ready){interacted=true;double p=v.getProgress()/1000.;display(indexAt(p),0,"");}}
            });
            viewport.setOnScrollChangeListener((v,x,y,ox,oy)->{
                if(ready&&!changing&&y!=oy){interacted=true;reachedEnd=false;offset=currentOffset();persist();updateStatus();scheduleSave();}
            });
            body.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){
                public void onViewAttachedToWindow(View v){}
                public void onViewDetachedFromWindow(View v){close();}
            });
            a.api.main.post(watch);
            if((id<1&&!detail.has("_filePath"))||!(isPdf()||format.equals("epub")||format.equals("kepub"))){fail("Geçersiz kitap veya desteklenmeyen biçim.");return;}
            a.api.io.execute(()->{
                File temp=null;
                try {
                    temp=File.createTempFile("reader-",".book",a.getCacheDir());
                    HttpURLConnection c=a.api.connection(filePath,"GET");downloading=c;
                    try {
                        c.setRequestProperty("Accept",isPdf()?"application/pdf":"application/epub+zip");
                        int code=c.getResponseCode();
                        if(code!=200)throw new IOException("Kitap indirilemedi (HTTP "+code+")");
                        if(c.getContentLengthLong()>MAX_DOWNLOAD)throw new IOException("Dosya 512 MB sınırını aşıyor.");
                        try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(temp)){
                            byte[] buf=new byte[32768];long n=0;int read;
                            while((read=in.read(buf))!=-1){if(closed)throw new InterruptedIOException();n+=read;if(n>MAX_DOWNLOAD)throw new IOException("Dosya çok büyük.");out.write(buf,0,read);}
                        }
                    } finally { downloading=null;c.disconnect(); }
                    if(closed){temp.delete();return;}
                    final File downloaded=temp;
                    try {worker.execute(()->load(downloaded));}catch(RejectedExecutionException e){downloaded.delete();}
                } catch(Exception e){if(temp!=null)temp.delete();post(()->fail(message(e)));}
            });
        }

        void tool(LinearLayout parent,String label,String description,Runnable click){
            TextView button=a.text(label,24,a.muted);button.setGravity(android.view.Gravity.CENTER);button.setContentDescription(description);button.setBackground(a.shape(0xff0c1022,8));parent.addView(button,new LinearLayout.LayoutParams(a.dp(44),a.dp(44)));button.setOnClickListener(v->click.run());
        }
        void options(){
            a.choose("Okuma seçenekleri",new String[]{"Sayfa / bölüme git","Yazıyı küçült","Yazıyı büyüt","Okuma teması",scrolled?"Sayfa sayfa oku":"Kaydırarak oku","Yer imi ekle","Yer imleri","İndir"},n->{
                if(n==0)goDialog();if(n==1)font(-10);if(n==2)font(10);
                if(n==3)a.choose("Okuma teması",new String[]{"Gece","Sepya","Gündüz"},t->{theme=t;prefs.edit().putInt("theme",t).apply();appearance();});
                if(n==4){scrolled=!scrolled;prefs.edit().putBoolean("scrolled",scrolled).apply();}
                if(n==5)bookmark();if(n==6)bookmarks();
                if(n==7)a.download(filePath+(filePath.contains("?")?"&":"?")+"download=1",detail.optString("title","Kitap")+(isPdf()?".pdf":".epub"),isPdf()?"application/pdf":"application/epub+zip");
            });
        }

        boolean isPdf(){return format.equals("pdf");}
        boolean alive(){return !closed&&!a.isDestroyed()&&a.generation==generation;}
        void post(Runnable r){a.api.main.post(()->{if(alive())r.run();});}
        void load(File downloaded){
            file=downloaded;
            try {
                if(closed){cleanup();return;}
                if(isPdf()){
                    descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
                    pdf=new PdfRenderer(descriptor);count=pdf.getPageCount();
                }else{zip=new ZipFile(file);parseBook();count=chapters.size();chapterStarts=new double[count+1];double total=0;for(int i=0;i<count;i++){chapterStarts[i]=total;ZipEntry z=zip.getEntry(chapters.get(i).path);total+=Math.max(1,z==null?1:z.getSize());}chapterStarts[count]=total;for(int i=0;i<=count;i++)chapterStarts[i]/=Math.max(1,total);}
                if(count==0)throw new IOException("Kitapta okunabilir sayfa/bölüm bulunamadı.");
                post(this::restore);
            }catch(Exception e){cleanup();post(()->fail(message(e)));}
        }

        void restore(){
            JSONObject saved=null;
            try{saved=new JSONObject(prefs.getString(key+":position","{}"));}catch(Exception ignored){}
            int target=0,at=0;
            // New server resets/updates supersede an older local position.
            long remote=0;
            JSONObject progress=detail.optJSONObject("progress");
            try{remote=java.time.Instant.parse(progress==null?detail.optString("updatedAt"):progress.optString("updatedAt")).toEpochMilli();}catch(Exception ignored){}
            localTime=saved==null?0:saved.optLong("time",0);
            boolean ownServerPosition=saved!=null&&progress!=null&&saved.optString("href").equals(serverLocation)
                    &&Math.abs(saved.optDouble("percent",-1)-initialPercent)<0.00001;
            if(saved!=null&&localTime>0&&(isPdf()||localTime>=remote||ownServerPosition)){
                target=saved.optInt("index",0);at=saved.optInt("offset",0);
            }else if(!isPdf()&&!serverLocation.isEmpty()){
                int found=findLocator(serverLocation);
                if(found>=0)target=found;
                else {
                    // Existing web CFIs cannot be resolved by Html.fromHtml; never fabricate one.
                    target=indexAt(initialPercent);
                    a.toast("Web/Kobo metin konumu çözülemedi; yaklaşık bölüm açıldı.");
                }
            }
            display(clamp(target,0,count-1),Math.max(0,at),serverLocation);
        }

        void display(int target,int at,String locator){
            if(!alive()||count==0)return;
            int ticket=++revision;changing=true;ready=false;
            reachedEnd=false;
            index=clamp(target,0,count-1);offset=at;
            status.setText("Açılıyor…");
            viewport.removeAllViews();picture=null;content=null;
            releaseRasterImages();
            if(bitmap!=null){bitmap.recycle();bitmap=null;}
            final int pageIndex=index;
            final int width=Math.max(200,Math.min(1800,body.getWidth()>0?body.getWidth()-a.dp(24):a.getResources().getDisplayMetrics().widthPixels));
            worker.execute(()->{
                Bitmap rendered=null;
                try {
                    if(closed||ticket!=revision)return;
                    if(isPdf()){
                        try(PdfRenderer.Page page=pdf.openPage(pageIndex)){
                            double scale=Math.min(width/(double)page.getWidth(),Math.sqrt(4000000d/(page.getWidth()*(double)page.getHeight())));
                            rendered=Bitmap.createBitmap(Math.max(1,(int)(page.getWidth()*scale)),Math.max(1,(int)(page.getHeight()*scale)),Bitmap.Config.ARGB_8888);
                            rendered.eraseColor(Color.WHITE);page.render(rendered,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        }
                        final Bitmap result=rendered;
                        a.api.main.post(()->{if(!alive()||ticket!=revision){result.recycle();return;}bitmap=result;picture=new MainActivity.ZoomImage(a);picture.setImageBitmap(result);picture.setAdjustViewBounds(true);int pageHeight=Math.max(viewport.getHeight(),Math.round(width*result.getHeight()/(float)result.getWidth()));viewport.addView(picture,new ScrollView.LayoutParams(-1,pageHeight));finishDisplay(at,locator,ticket);});
                    }else{
                        Chapter chapter=chapters.get(pageIndex);
                        String html=decodeHtml(entry(chapter.path,MAX_CHAPTER));
                        html=html.replaceAll("(?is)<(script|style|head)\\b[^>]*>.*?</\\1\\s*>","");
                        html=normalizeSvgImages(html);
                        Map<String,Integer> chapterAnchors=new HashMap<>();
                        Matcher ids=Pattern.compile("(?is)<[a-z][^>]*?\\s(?:id|name)\\s*=\\s*(['\"])(.*?)\\1[^>]*>").matcher(html);
                        StringBuffer marked=new StringBuffer();
                        while(ids.find())ids.appendReplacement(marked,Matcher.quoteReplacement("<readeranchor>"+ids.group(2)+"</readeranchor>"+ids.group()));
                        ids.appendTail(marked);
                        final int[] anchorStart={0};
                        final long[] imageBudget={0};
                        final int[] imageResults={0,0};
                        final ArrayList<Bitmap> decodedImages=new ArrayList<>();
                        Spanned text=Html.fromHtml(marked.toString(),Html.FROM_HTML_MODE_COMPACT,source->{
                            try{
                                android.graphics.drawable.Drawable drawable=chapterImage(chapter.path,source,width,imageBudget,0);decodedImages.add(((android.graphics.drawable.BitmapDrawable)drawable).getBitmap());imageResults[0]++;return drawable;
                            }catch(Exception e){imageResults[1]++;return null;}
                        },(opening,tag,output,reader)->{
                            if(!tag.equalsIgnoreCase("readeranchor"))return;
                            if(opening)anchorStart[0]=output.length();
                            else {String name=output.subSequence(anchorStart[0],output.length()).toString();output.delete(anchorStart[0],output.length());chapterAnchors.put(name,anchorStart[0]);}
                        });
                        SpannableStringBuilder displayed=nativeLinks(text,chapter.path);
                        boolean hasText=!text.toString().replace("\ufffc","").replaceAll("[\\s\\p{Z}]+","").isEmpty();
                        if(!hasText&&!decodedImages.isEmpty()){
                            // Large ImageSpans can be clipped by TextView line metrics. Image-only
                            // EPUB pages use explicit native image views, bounded by the viewport.
                            a.api.main.post(()->{
                                if(!alive()||ticket!=revision){for(Bitmap image:decodedImages)image.recycle();return;}
                                anchors=chapterAnchors;rasterBitmaps.addAll(decodedImages);
                                LinearLayout images=a.column();viewport.addView(images,new ScrollView.LayoutParams(-1,-2));
                                int height=Math.max(a.dp(120),viewport.getHeight()>0?viewport.getHeight():body.getHeight()-a.dp(96));
                                for(Bitmap image:decodedImages){
                                    ImageView nativeImage=new ImageView(a);nativeImage.setScaleType(ImageView.ScaleType.FIT_CENTER);nativeImage.setAdjustViewBounds(false);nativeImage.setPadding(a.dp(8),a.dp(8),a.dp(8),a.dp(8));nativeImage.setImageBitmap(image);nativeImage.setContentDescription(chapter.label+" · Kitap görseli");
                                    images.addView(nativeImage,new LinearLayout.LayoutParams(-1,height));if(picture==null)picture=nativeImage;
                                }
                                finishDisplay(0,locator,ticket);
                            });
                            return;
                        }
                        if(!hasText&&imageResults[0]==0){displayed.clear();displayed.append("Bu bölümde gösterilebilir metin veya desteklenen görsel bulunamadı. Sonraki bölüme geçebilir veya İçindekiler’den başka bir bölüm seçebilirsiniz.");}
                        else if(imageResults[1]>0)displayed.append("\n\nBazı görseller gösterilemedi; bu görsel biçimi desteklenmiyor veya dosya eksik.");
                        a.api.main.post(()->{if(!alive()||ticket!=revision){for(Bitmap image:decodedImages)image.recycle();return;}rasterBitmaps.addAll(decodedImages);anchors=chapterAnchors;content=a.text("",18,a.ink);int inset=a.getResources().getConfiguration().screenWidthDp>=640?40:16;content.setPadding(a.dp(inset),a.dp(18),a.dp(inset),a.dp(24));content.setTypeface(a.font("serif",400));content.setLineSpacing(0,1.7f);content.setTextIsSelectable(true);content.setText(displayed);content.setMovementMethod(LinkMovementMethod.getInstance());viewport.addView(content,new ScrollView.LayoutParams(-1,-2));finishDisplay(at,locator,ticket);});
                    }
                }catch(Exception e){if(rendered!=null)rendered.recycle();post(()->{if(ticket==revision)fail(message(e));});}
            });
        }

        android.graphics.drawable.Drawable chapterImage(String from,String source,int width,long[] budget,int depth)throws Exception{
            if(depth>4||budget[0]>=16*1024*1024)throw new IOException("Görsel sınırı aşıldı.");
            String path=resolve(from,source);byte[] bytes=entry(path,12*1024*1024);
            if(path.toLowerCase(Locale.ROOT).endsWith(".svg")){
                Matcher raster=Pattern.compile("(?is)<(?:[a-z0-9_-]+:)?image\\b([^>]*)>").matcher(decodeHtml(bytes));
                while(raster.find()){String href=htmlAttribute(raster.group(1),"(?:xlink:)?href");if(!href.isEmpty())return chapterImage(path,href,width,budget,depth+1);}
                throw new IOException("SVG içinde raster görsel yok.");
            }
            android.graphics.BitmapFactory.Options options=new android.graphics.BitmapFactory.Options();options.inJustDecodeBounds=true;
            android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
            if(options.outWidth<=0||options.outHeight<=0)throw new IOException("Görsel biçimi desteklenmiyor.");
            options.inSampleSize=1;long remaining=16*1024*1024-budget[0];
            while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>1600
                    ||(long)Math.max(1,options.outWidth/options.inSampleSize)*Math.max(1,options.outHeight/options.inSampleSize)*4>remaining){
                if(options.inSampleSize>=32768)throw new IOException("Görsel bellek sınırı.");options.inSampleSize*=2;
            }
            options.inJustDecodeBounds=false;Bitmap image=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
            if(image==null)throw new IOException("Görsel çözülemedi.");budget[0]+=image.getAllocationByteCount();
            android.graphics.drawable.BitmapDrawable drawable=new android.graphics.drawable.BitmapDrawable(a.getResources(),image);
            int inset=a.getResources().getConfiguration().screenWidthDp>=640?80:32;
            int w=Math.max(1,Math.min(width-a.dp(inset),image.getWidth()));
            drawable.setBounds(0,0,w,Math.max(1,(int)((long)image.getHeight()*w/image.getWidth())));return drawable;
        }

        void finishDisplay(int at,String locator,int ticket){
            appearance();
            viewport.post(()->{
                if(!alive()||ticket!=revision)return;
                if(at<0)viewport.scrollTo(0,Integer.MAX_VALUE);
                else if(isPdf())viewport.scrollTo(0,at);
                else if(picture!=null)viewport.scrollTo(0,0);
                else {
                    int position=at;
                    if(at==0&&locator!=null&&locator.contains("#")){
                        String anchor=locator.substring(locator.indexOf('#')+1);
                        try{anchor=URI.create("#"+anchor).getFragment();}catch(Exception ignored){}
                        if(anchors.containsKey(anchor))position=anchors.get(anchor);
                    }
                    scrollText(position);
                }
                viewport.post(()->{if(!alive()||ticket!=revision)return;changing=false;ready=true;offset=currentOffset();updateStatus();if(interacted){persist();scheduleSave();}});
            });
        }

        SpannableStringBuilder nativeLinks(Spanned source,String from){
            SpannableStringBuilder text=new SpannableStringBuilder(source);
            for(URLSpan link:text.getSpans(0,text.length(),URLSpan.class)){
                int start=text.getSpanStart(link),end=text.getSpanEnd(link);text.removeSpan(link);
                String href=link.getURL();
                text.setSpan(new ClickableSpan(){@Override public void onClick(View v){
                    try{URI uri=new URI(href);if(uri.isAbsolute()||href.startsWith("//")){a.toast("Harici bağlantı: "+href);return;}
                        String path=resolve(from,href);int i=findPath(path);if(i>=0){interacted=true;display(i,0,href);}else a.toast("Bağlantı okunabilir bir bölüme gitmiyor.");
                    }catch(Exception e){a.toast("Geçersiz bağlantı.");}
                }},start,end,Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            return text;
        }

        int currentOffset(){
            if(isPdf())return viewport.getScrollY();
            if(picture!=null)return 0;
            if(content==null||content.getLayout()==null)return offset;
            Layout layout=content.getLayout();int y=Math.max(0,viewport.getScrollY()-content.getPaddingTop());
            return layout.getLineStart(layout.getLineForVertical(y));
        }
        void scrollText(int at){
            if(content==null||content.getLayout()==null)return;
            Layout layout=content.getLayout();int pos=clamp(at,0,content.length());
            viewport.scrollTo(0,layout.getLineTop(layout.getLineForOffset(pos))+ (pos==0?0:content.getPaddingTop()));
        }
        double fraction(){
            if(isPdf())return index/(double)Math.max(1,count);
            if(reachedEnd)return 1;
            boolean bottom=content!=null&&interacted&&viewport.getScrollY()>0&&viewport.getScrollY()>=content.getHeight()-viewport.getHeight()-a.dp(2);
            if(bottom&&index==count-1)return 1;
            double part=bottom?1:(content==null||content.length()==0?0:offset/(double)content.length());
            double value=chapterStarts==null?(index+part)/Math.max(1,count):chapterStarts[index]+part*(chapterStarts[index+1]-chapterStarts[index]);
            return Math.min(.979,unit(value));
        }
        int indexAt(double value){if(chapterStarts!=null){for(int i=0;i<count;i++)if(value<chapterStarts[i+1])return i;return Math.max(0,count-1);}return Math.min(Math.max(0,count-1),(int)(value*count));}
        void updateStatus(){
            if(count==0)return;
            status.setText((isPdf()?"Sayfa ":chapters.get(index).label+" · ")+(index+1)+" / "+count+" · %"+Math.round(fraction()*100)+(isPdf()?"":" (yaklaşık)"));
            seek.setProgress((int)(fraction()*1000));
        }
        void persist(){
            if(!ready)return;
            offset=currentOffset();localTime=System.currentTimeMillis();
            prefs.edit().putString(key+":position",a.obj("index",index,"offset",offset,"time",localTime,
                    "href",isPdf()?"":chapters.get(index).href,"percent",unit(fraction())).toString()).apply();
        }
        void scheduleSave(){a.api.main.removeCallbacks(save);if(!isPdf())a.api.main.postDelayed(save,800);}
        void saveServer(){
            if(isPdf()||chapters.isEmpty()||!interacted)return;
            // EPUB.js accepts manifest hrefs in display(). Do not send Android offsets or fake CFIs.
            final String href=chapters.get(index).href;
            final double percent=unit(fraction());
            final JSONObject payload=a.obj("location",href,"percent",percent);
            sync.setText("İlerleme kaydediliyor…");
            enqueueProgress(payload,true);
        }
        void enqueueProgress(JSONObject payload,boolean report){
            // Serial with other saves, so a slow old request cannot overwrite a newer position.
            try{worker.execute(()->{try{a.api.sync("PUT",progressPath,payload);if(report)post(()->sync.setText("Bölüm sunucuya kaydedildi; metin konumu bu cihazda."));}
                catch(Exception e){if(report)post(()->sync.setText("Sunucuya kaydedilemedi; yerel kayıt korundu. "+message(e)));}
            });}catch(RejectedExecutionException ignored){}
        }
        void step(int direction){
            if(!ready)return;interacted=true;
            if(!isPdf()&&!scrolled){
                View page=content!=null?content:viewport.getChildAt(0);
                int y=viewport.getScrollY(),max=Math.max(0,(page==null?0:page.getHeight())-viewport.getHeight());
                if(direction>0&&y<max-2){viewport.smoothScrollBy(0,Math.max(1,viewport.getHeight()-a.dp(32)));return;}
                if(direction<0&&y>2){viewport.smoothScrollBy(0,-Math.max(1,viewport.getHeight()-a.dp(32)));return;}
            }
            int next=index+direction;
            if(next<0||next>=count){
                View endPage=viewport.getChildAt(0);
                if(next>=count&&!isPdf()&&endPage!=null&&viewport.getScrollY()>=endPage.getHeight()-viewport.getHeight()-a.dp(2)){reachedEnd=true;persist();updateStatus();scheduleSave();}
                a.toast(direction<0?"Kitabın başı":"Kitabın sonu");return;
            }
            display(next,direction<0&&!isPdf()?-1:0,"");
        }
        void goDialog(){if(!ready)return;a.prompt(isPdf()?"Sayfa (1–"+count+")":"Bölüm (1–"+count+")",String.valueOf(index+1),s->{try{int i=Integer.parseInt(s.trim())-1;if(i<0||i>=count)throw new NumberFormatException();interacted=true;display(i,0,"");}catch(Exception e){a.toast("Geçerli bir numara girin.");}});}
        void toc(){
            if(!ready||isPdf()){a.toast(isPdf()?"PDF için sayfa numarasıyla gidin.":"Kitap henüz hazır değil.");return;}
            List<Nav> items=new ArrayList<>(navigation);
            if(items.isEmpty())for(Chapter c:chapters)items.add(new Nav(c.label,c.path));
            String[] labels=new String[items.size()];for(int i=0;i<labels.length;i++)labels[i]=items.get(i).label;
            a.choose("İçindekiler",labels,i->{int target=findPath(items.get(i).path);if(target>=0){interacted=true;display(target,0,items.get(i).path);}else a.toast("Bu bölüm omurgada bulunamadı.");});
        }
        void font(int delta){
            if(isPdf()){a.toast("PDF yazı boyutu sabittir.");return;}
            int pos=currentOffset();font=clamp(font+delta,70,220);prefs.edit().putInt("font",font).apply();changing=true;appearance();
            viewport.post(()->{scrollText(pos);viewport.post(()->{changing=false;offset=currentOffset();});});
        }
        void appearance(){
            int[] bg={0xff10142b,0xfff1e6cf,0xfffbfaf7},fg={0xffdfe3f7,0xff3b3024,0xff1d1f2b};
            viewport.setBackgroundColor(bg[theme]);
            if(content!=null){content.setBackgroundColor(bg[theme]);content.setTextColor(fg[theme]);content.setLinkTextColor(0xff7a8cff);content.setTextSize(16*font/100f);}
        }
        JSONArray marks(){try{return new JSONArray(prefs.getString(key+":marks","[]"));}catch(Exception e){return new JSONArray();}}
        void bookmark(){if(!ready)return;persist();a.prompt("Yer imi adı",(isPdf()?"Sayfa ":"Bölüm ")+(index+1),name->{JSONArray list=marks();if(list.length()>=200){a.toast("En fazla 200 yer imi saklanabilir.");return;}list.put(a.obj("name",name,"index",index,"offset",currentOffset()));prefs.edit().putString(key+":marks",list.toString()).apply();a.toast("Yer imi kaydedildi.");});}
        void bookmarks(){
            JSONArray list=marks();if(list.length()==0){a.toast("Henüz yer imi yok.");return;}
            String[] names=new String[list.length()];for(int i=0;i<names.length;i++)names[i]=list.optJSONObject(i).optString("name","Yer imi");
            a.choose("Yer imleri",names,i->{JSONObject mark=list.optJSONObject(i);new AlertDialog.Builder(a).setTitle(names[i]).setPositiveButton("Aç",(d,w)->{interacted=true;display(mark.optInt("index"),mark.optInt("offset"),"");}).setNegativeButton("Sil",(d,w)->{list.remove(i);prefs.edit().putString(key+":marks",list.toString()).apply();}).setNeutralButton("Vazgeç",null).show();});
        }
        void fail(String reason){ready=false;changing=false;status.setText("Kitap açılamadı");viewport.removeAllViews();LinearLayout error=a.column();error.setPadding(a.dp(24),a.dp(32),a.dp(24),a.dp(24));viewport.addView(error);TextView message=a.text(reason,16,a.ink);message.setTextIsSelectable(true);error.addView(message);a.button(error,"Yeniden dene",()->{close();show(a,detail);});}

        void close(){
            if(closed)return;
            if(ready){persist();if(!isPdf()&&interacted&&!chapters.isEmpty())enqueueProgress(a.obj("location",chapters.get(index).href,"percent",unit(fraction())),false);}
            closed=true;revision++;
            a.api.main.removeCallbacks(save);a.api.main.removeCallbacks(watch);
            HttpURLConnection c=downloading;if(c!=null)c.disconnect();
            if(picture!=null)picture.setImageDrawable(null);
            viewport.removeAllViews();releaseRasterImages();
            if(bitmap!=null){bitmap.recycle();bitmap=null;}
            worker.execute(this::cleanup);worker.shutdown();
        }
        void releaseRasterImages(){for(Bitmap image:rasterBitmaps)if(!image.isRecycled())image.recycle();rasterBitmaps.clear();}
        void cleanup(){
            if(pdf!=null){try{pdf.close();}catch(Exception ignored){}pdf=null;}
            if(descriptor!=null){try{descriptor.close();}catch(Exception ignored){}descriptor=null;}
            if(zip!=null){try{zip.close();}catch(Exception ignored){}zip=null;}
            if(file!=null){file.delete();file=null;}
        }

        byte[] entry(String name,int limit)throws Exception{
            ZipEntry item=zip.getEntry(name);if(item==null)throw new IOException("EPUB girdisi bulunamadı: "+name);
            if(item.getSize()>limit)throw new IOException("EPUB bölümü bellek sınırını aşıyor: "+name);
            try(InputStream in=zip.getInputStream(item);ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buf=new byte[8192];int n,total=0;
                while((n=in.read(buf))!=-1){if(closed)throw new InterruptedIOException();total+=n;if(total>limit)throw new IOException("EPUB girdisi çok büyük.");out.write(buf,0,n);}return out.toByteArray();
            }
        }
        XmlPullParser xml(String name)throws Exception{
            byte[] bytes=entry(name,MAX_XML);
            XmlPullParserFactory factory=XmlPullParserFactory.newInstance();factory.setNamespaceAware(true);
            XmlPullParser p=factory.newPullParser();p.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES,true);
            p.setFeature(XmlPullParser.FEATURE_PROCESS_DOCDECL,false);
            p.setInput(new ByteArrayInputStream(bytes),null);return p;
        }
        int next(XmlPullParser p)throws Exception{
            int event=p.nextToken();
            while(event==XmlPullParser.DOCDECL)event=p.nextToken();
            return event;
        }
        String attr(XmlPullParser p,String name){for(int i=0;i<p.getAttributeCount();i++)if(name.equals(p.getAttributeName(i)))return p.getAttributeValue(i);return "";}
        void parseBook()throws Exception{
            XmlPullParser container=xml("META-INF/container.xml");
            for(int e=next(container);e!=XmlPullParser.END_DOCUMENT;e=next(container))if(e==XmlPullParser.START_TAG&&container.getName().equals("rootfile")){
                String candidate=attr(container,"full-path");if(opfPath==null||"application/oebps-package+xml".equals(attr(container,"media-type")))opfPath=resolve("",candidate);
            }
            if(opfPath==null)throw new IOException("EPUB paket dosyası bulunamadı.");
            if(zip.getEntry("META-INF/encryption.xml")!=null){
                // Font obfuscation is harmless for native text; encrypted chapters cannot be decoded.
                XmlPullParser encryption=xml("META-INF/encryption.xml");
                for(int e=next(encryption);e!=XmlPullParser.END_DOCUMENT;e=next(encryption))if(e==XmlPullParser.START_TAG&&encryption.getName().equals("EncryptedData")){
                    post(()->sync.setText("EPUB şifreli kaynaklar içeriyor; DRM metni desteklenmez."));break;
                }
            }
            Map<String,String[]> manifest=new HashMap<>();ArrayList<String> spine=new ArrayList<>();
            String nav="",ncx="",tocId="";XmlPullParser p=xml(opfPath);
            for(int e=next(p);e!=XmlPullParser.END_DOCUMENT;e=next(p)){
                if(e!=XmlPullParser.START_TAG)continue;
                if(p.getName().equals("item")){
                    String itemId=attr(p,"id"),href=attr(p,"href"),type=attr(p,"media-type"),props=attr(p,"properties");
                    manifest.put(itemId,new String[]{href,type});
                    if(Arrays.asList(props.split("\\s+")).contains("nav"))nav=resolve(opfPath,href);
                    if(type.equals("application/x-dtbncx+xml"))ncx=resolve(opfPath,href);
                }else if(p.getName().equals("spine"))tocId=attr(p,"toc");
                else if(p.getName().equals("itemref"))spine.add(attr(p,"idref"));
                if(spine.size()>10000||manifest.size()>20000)throw new IOException("EPUB paket listesi çok büyük.");
            }
            for(String ref:spine){String[] item=manifest.get(ref);if(item==null)throw new IOException("EPUB omurga girdisi eksik: "+ref);
                if(item[1].equals("application/xhtml+xml")||item[1].equals("text/html"))chapters.add(new Chapter(resolve(opfPath,item[0]),item[0]));
            }
            if(manifest.containsKey(tocId))ncx=resolve(opfPath,manifest.get(tocId)[0]);
            try{if(!nav.isEmpty())parseNav(nav);else if(!ncx.isEmpty())parseNcx(ncx);}catch(Exception e){navigation.clear();}
            for(Nav n:navigation){int i=findPath(n.path);if(i>=0&&chapters.get(i).label.equals(chapters.get(i).href))chapters.get(i).label=n.label;}
        }
        void parseNav(String path)throws Exception{
            XmlPullParser p=xml(path);int tocDepth=-1,aDepth=-1;String href="";StringBuilder label=new StringBuilder();
            for(int e=next(p);e!=XmlPullParser.END_DOCUMENT;e=next(p)){
                if(e==XmlPullParser.START_TAG){
                    if(p.getName().equals("nav")&&(Arrays.asList(attr(p,"type").split("\\s+")).contains("toc")||attr(p,"role").equals("doc-toc")))tocDepth=p.getDepth();
                    if(tocDepth>=0&&p.getName().equals("a")){aDepth=p.getDepth();href=attr(p,"href");label.setLength(0);}
                }else if(e==XmlPullParser.TEXT&&aDepth>=0)label.append(p.getText());
                else if(e==XmlPullParser.END_TAG){
                    if(p.getDepth()==aDepth){addNav(label.toString(),resolveLocator(path,href));aDepth=-1;}
                    if(p.getDepth()==tocDepth)tocDepth=-1;
                }
            }
        }
        void parseNcx(String path)throws Exception{
            XmlPullParser p=xml(path);ArrayDeque<String[]> stack=new ArrayDeque<>();boolean text=false;
            for(int e=next(p);e!=XmlPullParser.END_DOCUMENT;e=next(p)){
                if(e==XmlPullParser.START_TAG){
                    if(p.getName().equals("navPoint"))stack.push(new String[]{"",""});
                    if(!stack.isEmpty()&&p.getName().equals("text"))text=true;
                    if(!stack.isEmpty()&&p.getName().equals("content")){stack.peek()[1]=resolveLocator(path,attr(p,"src"));addNav(stack.peek()[0],stack.peek()[1]);}
                }else if(e==XmlPullParser.TEXT&&text&&!stack.isEmpty())stack.peek()[0]+=p.getText();
                else if(e==XmlPullParser.END_TAG){if(p.getName().equals("text"))text=false;if(p.getName().equals("navPoint")&&!stack.isEmpty())stack.pop();}
            }
        }
        void addNav(String label,String path)throws IOException{if(navigation.size()>10000)throw new IOException("İçindekiler çok büyük.");if(!label.trim().isEmpty())navigation.add(new Nav(label.trim(),path));}
        int findPath(String path){String plain=stripFragment(path);for(int i=0;i<chapters.size();i++)if(chapters.get(i).path.equals(plain))return i;return -1;}
        int findLocator(String locator){try{if(locator.startsWith("epubcfi(")){Matcher step=Pattern.compile("epubcfi\\(/6/(\\d+)").matcher(locator);if(step.find())return clamp(Integer.parseInt(step.group(1))/2-1,0,Math.max(0,chapters.size()-1));}return findPath(resolve(opfPath,locator));}catch(Exception e){return -1;}}
    }

    private static String htmlAttribute(String attributes,String name){
        Matcher match=Pattern.compile("(?is)(?:^|\\s)"+name+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))").matcher(attributes);
        if(!match.find())return "";String value=match.group(1)!=null?match.group(1):match.group(2)!=null?match.group(2):match.group(3);
        return Html.fromHtml(value,Html.FROM_HTML_MODE_COMPACT).toString();
    }
    /** Html.fromHtml understands img, but silently discards SVG image elements. */
    private static String normalizeSvgImages(String html){
        Matcher images=Pattern.compile("(?is)<(?:[a-z0-9_-]+:)?image\\b([^>]*)>").matcher(html);StringBuffer result=new StringBuffer();
        while(images.find()){
            String href=htmlAttribute(images.group(1),"(?:xlink:)?href");
            String replacement=href.isEmpty()?"":"<img src=\""+android.text.TextUtils.htmlEncode(href)+"\" />";
            images.appendReplacement(result,Matcher.quoteReplacement(replacement));
        }
        images.appendTail(result);return result.toString();
    }
    private static String resolve(String from,String href)throws IOException{
        try{
            URI relative=new URI(href);
            if(relative.isAbsolute()||relative.getRawAuthority()!=null)throw new IOException("EPUB içinde harici kaynak.");
            URI base=new URI(null,null,"/"+stripFragment(from),null);
            URI resolved=base.resolve(relative).normalize();String path=resolved.getPath();
            if(path==null||!path.startsWith("/")||path.contains("/../")||path.contains("\\"))throw new IOException("Geçersiz EPUB yolu.");
            return path.substring(1);
        }catch(java.net.URISyntaxException e){throw new IOException("Geçersiz EPUB yolu.",e);}
    }
    private static String resolveLocator(String from,String href)throws IOException{
        String path=resolve(from,href);int fragment=href.indexOf('#');return fragment<0?path:path+href.substring(fragment);
    }
    private static String decodeHtml(byte[] bytes){
        if(bytes.length>=2&&((bytes[0]&255)==255&&(bytes[1]&255)==254||(bytes[0]&255)==254&&(bytes[1]&255)==255))return new String(bytes,StandardCharsets.UTF_16);
        String header=new String(bytes,0,Math.min(bytes.length,256),StandardCharsets.US_ASCII);
        Matcher encoding=Pattern.compile("(?i)<\\?xml[^>]*encoding\\s*=\\s*['\"]([^'\"]+)['\"]").matcher(header);
        if(encoding.find())try{return new String(bytes,Charset.forName(encoding.group(1)));}catch(Exception ignored){}
        return new String(bytes,StandardCharsets.UTF_8);
    }
    private static String stripFragment(String value){int i=value.indexOf('#');return i<0?value:value.substring(0,i);}
    private static int clamp(int n,int min,int max){return Math.max(min,Math.min(max,n));}
    private static double unit(double n){return Double.isFinite(n)?Math.max(0,Math.min(1,n)):0;}
    private static String message(Exception e){return e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();}
}
