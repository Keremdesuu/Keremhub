package com.keremhub.test;

import android.app.*;
import android.content.*;
import android.media.MediaPlayer;
import android.os.*;
import android.view.*;
import android.widget.*;
import com.keremhub.app.*;
import org.json.JSONObject;
import java.lang.reflect.*;
import java.util.concurrent.*;
import android.graphics.Bitmap;

/** No gallery detail/view POSTs: opens only a read-only video stream. */
public final class GalleryPlayerTest extends Instrumentation {
    private MainActivity activity;private Object session;private boolean baseline;
    private void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    private void ui(Runnable action){runOnMainSync(action);waitForIdleSync();}
    private Object field(Object object,String name)throws Exception{Field f=object.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(object);}
    private void call(String name,Class<?> type,Object value){ui(()->{try{Method m=session.getClass().getDeclaredMethod(name,type);m.setAccessible(true);m.invoke(session,value);}catch(Exception e){throw new RuntimeException(e);}});}
    private Object read(String name)throws Exception{Object[] result={null};ui(()->{try{result[0]=field(session,name);}catch(Exception e){throw new RuntimeException(e);}});return result[0];}
    private void ready()throws Exception{long until=SystemClock.elapsedRealtime()+90000;while(SystemClock.elapsedRealtime()<until){if(Boolean.TRUE.equals(read("ready")))return;Thread.sleep(100);}throw new AssertionError("Player did not prepare in 90 seconds");}
    private int position()throws Exception{int[] value={0};ui(()->{try{value[0]=((MediaPlayer)field(session,"player")).getCurrentPosition();}catch(Exception e){throw new RuntimeException(e);}});return value[0];}
    private void pause(){ui(()->{try{Method m=session.getClass().getDeclaredMethod("pause");m.setAccessible(true);m.invoke(session);}catch(Exception e){throw new RuntimeException(e);}});}
    private void event(String message){Bundle b=new Bundle();b.putString("stream",message+"\n");sendStatus(0,b);}
    private long seek(double ratio)throws Exception{MediaPlayer mp=(MediaPlayer)read("player");int target=(int)(mp.getDuration()*ratio);CountDownLatch finished=new CountDownLatch(1);ui(()->mp.setOnSeekCompleteListener(m->finished.countDown()));long begin=SystemClock.elapsedRealtime();call("ratio",double.class,ratio);check(finished.await(60,TimeUnit.SECONDS),"Seek did not complete: "+ratio);check(Math.abs(position()-target)<3000,"Seek target mismatch");return SystemClock.elapsedRealtime()-begin;}
    private double[] pixels()throws Exception{TextureView surface=(TextureView)read("video");Bitmap[] image={null};ui(()->image[0]=surface.getBitmap(64,64));check(image[0]!=null,"No decoded frame on texture");Bitmap bitmap=image[0];double[] mean=new double[3];for(int y=0;y<64;y++)for(int x=0;x<64;x++){int color=bitmap.getPixel(x,y);mean[0]+=(color>>16)&255;mean[1]+=(color>>8)&255;mean[2]+=color&255;}bitmap.recycle();for(int i=0;i<3;i++)mean[i]/=4096;check(mean[0]+mean[1]+mean[2]>3,"Texture is black after transfer");return mean;}
    private void sameFrame(double[] original)throws Exception{double[] current=pixels();for(int i=0;i<3;i++)check(Math.abs(current[i]-original[i])<12,"Paused frame changed after transfer");}
    @Override public void onCreate(Bundle args){baseline=args!=null&&"true".equals(args.getString("baseline"));super.onCreate(args);start();}
    @Override public void onStart(){Bundle result=new Bundle();int status=-1;try{
        activity=(MainActivity)startActivitySync(new Intent().setClassName("com.keremhub.app","com.keremhub.app.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        long begin=SystemClock.elapsedRealtime();
        ui(()->{try{
            Constructor<?> outer=GalleryScreen.class.getDeclaredConstructor(MainActivity.class);outer.setAccessible(true);Object screen=outer.newInstance(activity);
            LinearLayout body=activity.page("Oynatma testi","");Field f=GalleryScreen.class.getDeclaredField("body");f.setAccessible(true);f.set(screen,body);
            Class<?> type=Class.forName("com.keremhub.app.GalleryScreen$GalleryPlayer");Constructor<?> ctor=type.getDeclaredConstructor(GalleryScreen.class,JSONObject.class,boolean.class,int.class);ctor.setAccessible(true);
            session=ctor.newInstance(screen,new JSONObject().put("id",263).put("title","Oynatma testi").put("width",1906).put("height",1080),false,0);
            Method attach=type.getDeclaredMethod("attach",LinearLayout.class);attach.setAccessible(true);attach.invoke(session,body);
        }catch(Exception e){throw new RuntimeException(e);}});
        ready();long open=SystemClock.elapsedRealtime()-begin;event("Opened in "+open+" ms");pause();
        long forward=seek(.3),backward=seek(.1);event("Seek forward "+forward+" ms; backward "+backward+" ms");
        Object original=read("player");Object video=read("video");int before=position();double[] frameBefore=baseline?null:pixels();
        begin=SystemClock.elapsedRealtime();call("setFullscreen",boolean.class,true);ready();Thread.sleep(500);long enter=SystemClock.elapsedRealtime()-begin;
        boolean retained=original==read("player");event("Fullscreen enter "+enter+" ms; retained MediaPlayer="+retained);
        check(Math.abs(position()-before)<3000,"Fullscreen changed paused position");if(!baseline){check(retained&&video==read("video"),"Fullscreen replaced player/video");sameFrame(frameBefore);}
        begin=SystemClock.elapsedRealtime();call("setFullscreen",boolean.class,false);ready();Thread.sleep(500);long exit=SystemClock.elapsedRealtime()-begin;
        if(!baseline){check(original==read("player")&&video==read("video"),"Fullscreen exit replaced player/video");sameFrame(frameBefore);}check(Math.abs(position()-before)<3000,"Fullscreen exit changed paused position");
        MediaPlayer mp=(MediaPlayer)read("player");check(!mp.isPlaying(),"Paused transfer resumed playback");
        ui(()->{try{Method m=session.getClass().getDeclaredMethod("toggle");m.setAccessible(true);m.invoke(session);}catch(Exception e){throw new RuntimeException(e);}});Thread.sleep(700);
        call("setFullscreen",boolean.class,true);ready();Thread.sleep(700);check(((MediaPlayer)read("player")).isPlaying(),"Playing transfer stopped playback");if(!baseline)check(original==read("player"),"Playing transfer reopened player");
        call("setFullscreen",boolean.class,false);ready();
        result.putString("stream","PASS Gallery player: open="+open+"ms, forward="+forward+"ms, backward="+backward+"ms, fullscreenEnter="+enter+"ms, fullscreenExit="+exit+"ms, retained="+retained);
    }catch(Throwable error){status=1;result.putString("failure",android.util.Log.getStackTraceString(error));}finally{if(activity!=null)ui(()->activity.hub());}finish(status,result);}
}
