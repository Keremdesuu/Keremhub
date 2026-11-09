package com.keremhub.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

public final class Api {
    public final ExecutorService io=Executors.newFixedThreadPool(5);
    public final Handler main=new Handler(Looper.getMainLooper());
    private final MainActivity a;
    private final LruCache<String,Bitmap> images=new LruCache<String,Bitmap>(24*1024*1024){protected int sizeOf(String k,Bitmap b){return b.getAllocationByteCount();}};
    Api(MainActivity a){this.a=a; CookieHandler.setDefault(new CookieManager(null,CookiePolicy.ACCEPT_ORIGINAL_SERVER));}
    public String url(String path){if(path.startsWith("http://")||path.startsWith("https://"))return path;return a.base()+(path.startsWith("/")?path:"/"+path);}
    public HttpURLConnection connection(String path,String method)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(url(path)).openConnection();
        c.setConnectTimeout(12000);c.setReadTimeout(30000);c.setRequestMethod(method);
        c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("User-Agent","Keremhub-Android/1.0");
        // The existing LAN server checks same-origin writes.
        URI u=URI.create(url(path)); c.setRequestProperty("Origin",u.getScheme()+"://"+u.getRawAuthority());
        c.setRequestProperty("Referer",u.getScheme()+"://"+u.getRawAuthority()+"/");
        return c;
    }
    public static byte[] read(InputStream in)throws IOException{try(InputStream input=in;ByteArrayOutputStream out=new ByteArrayOutputStream()){Compat.copy(input,out);return out.toByteArray();}}
    public Object sync(String method,String path,JSONObject body)throws Exception{
        HttpURLConnection c=connection(path,method);
        try{if(body!=null){c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=utf-8");try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}}
            int status=c.getResponseCode();InputStream stream=status<400?c.getInputStream():c.getErrorStream();
            String s=stream==null?"":new String(read(stream),"UTF-8");
            if(status>=400){String message="Sunucu hatası ("+status+")";try{JSONObject e=new JSONObject(s);message=e.optString("error",e.optString("hata",message));}catch(Exception ignored){}throw new IOException(message);}
            return s.trim().isEmpty()?new JSONObject():new JSONTokener(s).nextValue();
        }finally{c.disconnect();}
    }
    public void request(String method,String path,JSONObject body,Consumer<Object> done){int token=a.generation;io.execute(()->{try{Object result=sync(method,path,body);main.post(()->{if(!a.isDestroyed()&&token==a.generation)done.accept(result);});}catch(Exception e){main.post(()->{if(!a.isDestroyed()&&token==a.generation)a.failure(e.getMessage());});}});}
    /** Playback metadata must not wait behind the artwork download queue. */
    public void playbackRequest(String path,Consumer<JSONObject> done){
        int token=a.generation;
        Thread worker=new Thread(()->{
            try{Object result=sync("GET",path,null);if(!(result instanceof JSONObject))throw new IOException("Geçersiz oynatma yanıtı");
                main.post(()->{if(!a.isDestroyed()&&token==a.generation)done.accept((JSONObject)result);});
            }catch(Exception e){main.post(()->{if(!a.isDestroyed()&&token==a.generation)a.failure(e.getMessage());});}
        },"Keremflix-playback");worker.setDaemon(true);worker.start();
    }
    public void image(String path,Consumer<Bitmap> done){image(path,1400,done);}
    public void image(String path,int maxSide,Consumer<Bitmap> done){
        if(path==null||path.trim().isEmpty()||path.equals("null"))return;
        String key=url(path)+"#"+maxSide;Bitmap cached=images.get(key);
        if(cached!=null){done.accept(cached);return;}
        int token=a.generation;
        io.execute(()->{
            if(token!=a.generation)return;
            try{
                HttpURLConnection c=connection(path,"GET");byte[] data;
                try{c.setRequestProperty("Accept","image/*");if(c.getResponseCode()!=200)throw new IOException("Image HTTP "+c.getResponseCode());
                    try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                        byte[] buffer=new byte[16384];int n,total=0;while((n=in.read(buffer))!=-1){total+=n;if(total>20*1024*1024)throw new IOException("Image too large");out.write(buffer,0,n);}data=out.toByteArray();
                    }
                }finally{c.disconnect();}
                BitmapFactory.Options opts=new BitmapFactory.Options();opts.inJustDecodeBounds=true;
                BitmapFactory.decodeByteArray(data,0,data.length,opts);opts.inSampleSize=1;
                while(Math.max(opts.outWidth,opts.outHeight)/opts.inSampleSize>maxSide)opts.inSampleSize*=2;
                opts.inJustDecodeBounds=false;Bitmap b=BitmapFactory.decodeByteArray(data,0,data.length,opts);
                if(b!=null){images.put(key,b);main.post(()->{if(token==a.generation&&!a.isDestroyed())done.accept(b);});}
            }catch(Exception e){android.util.Log.w("KeremhubImage",e.getClass().getSimpleName()+": "+e.getMessage());}
        });
    }
}