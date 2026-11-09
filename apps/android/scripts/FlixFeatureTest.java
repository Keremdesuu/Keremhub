package com.keremhub.test;

import android.app.*;
import android.content.*;
import android.graphics.Bitmap;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.lang.reflect.*;
import com.keremhub.app.*;

/** Instrumentation over the signed app, using an in-memory write proxy. */
public class FlixFeatureTest extends Instrumentation {
    private MainActivity activity;private String original;private SharedPreferences prefs;private File screenshots;
    private void ui(Runnable action){runOnMainSync(action);waitForIdleSync();}
    private void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    private Object field(Object target,String name)throws Exception{Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(target);}
    private void call(Object target,String name)throws Exception{Method m=target.getClass().getDeclaredMethod(name);m.setAccessible(true);m.invoke(target);}
    private void reflectUi(Object target,String name){ui(()->{try{call(target,name);}catch(Exception e){throw new RuntimeException(e);}});}
    private void dismiss(Object player)throws Exception{PopupWindow popup=(PopupWindow)field(player,"menu");ui(popup::dismiss);}
    private void position(Object player,int value){ui(()->{try{Field f=player.getClass().getDeclaredField("subtitlePosition");f.setAccessible(true);f.setInt(player,value);call(player,"saveSubtitlePreferences");}catch(Exception e){throw new RuntimeException(e);}});}
    private void hideControls(Object player){ui(()->{try{Method m=player.getClass().getDeclaredMethod("controls",boolean.class);m.setAccessible(true);m.invoke(player,false);}catch(Exception e){throw new RuntimeException(e);}});}
    private View find(View view,String label){if((view.getContentDescription()!=null&&label.contentEquals(view.getContentDescription()))||(view instanceof TextView&&label.contentEquals(((TextView)view).getText())))return view;if(view instanceof ViewGroup){ViewGroup g=(ViewGroup)view;for(int i=0;i<g.getChildCount();i++){View found=find(g.getChildAt(i),label);if(found!=null)return found;}}return null;}
    private View await(View root,String label)throws Exception{long end=SystemClock.elapsedRealtime()+20000;while(SystemClock.elapsedRealtime()<end){View[] result={null};ui(()->result[0]=find(root,label));if(result[0]!=null)return result[0];Thread.sleep(100);}throw new AssertionError("Missing "+label);}
    private void click(View root,String label)throws Exception{View v=await(root,label);ui(()->{check(v.isEnabled(),"Disabled "+label);v.performClick();});}
    private void capture(String name)throws Exception{Thread.sleep(500);Bitmap b=getUiAutomation().takeScreenshot();try(FileOutputStream out=new FileOutputStream(new File(screenshots,name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}b.recycle();}
    private void waitField(Object object,String name,Object expected)throws Exception{long end=SystemClock.elapsedRealtime()+30000;while(SystemClock.elapsedRealtime()<end){Object[] result={null};ui(()->{try{result[0]=field(object,name);}catch(Exception e){throw new RuntimeException(e);}});if(expected.equals(result[0]))return;Thread.sleep(100);}throw new AssertionError("Timed out "+name+" expected "+expected);}
    @Override public void onCreate(Bundle args){super.onCreate(args);start();}
    @Override public void onStart(){Bundle result=new Bundle();int status=-1;try{
        activity=(MainActivity)startActivitySync(new Intent().setClassName("com.keremhub.app","com.keremhub.app.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        prefs=activity.getSharedPreferences("keremhub",0);original=prefs.getString("server",null);if("http://127.0.0.1:18765".equals(original))original=null;prefs.edit().putString("server","http://127.0.0.1:18765").commit();
        screenshots=new File(activity.getExternalFilesDir(null),"flix-feature-qa");screenshots.mkdirs();
        activity.getSharedPreferences("keremflix.subtitle-preferences.v1",0).edit().clear().commit();
        ui(()->{try{Constructor<?> c=FlixScreen.class.getDeclaredConstructor(MainActivity.class);c.setAccessible(true);Object screen=c.newInstance(activity);Method m=FlixScreen.class.getDeclaredMethod("detail",int.class);m.setAccessible(true);m.invoke(screen,98);}catch(Exception e){throw new RuntimeException(e);}});
        View root=activity.getWindow().getDecorView();await(root,"Film eşleşmesini düzelt");capture("film-detail");click(root,"Film eşleşmesini düzelt");View editor=(View)await(root,"Film adı").getParent().getParent();click(editor,"Ara");await(root,"Doğru Film · 2001");capture("film-matches");click(root,"Doğru Film · 2001");await(root,"Doğru Film");click(root,"İzlenmedi olarak işaretle");await(root,"Oynat");capture("film-reset");
        // Use the real LAN media with a blank progress path; no progress writes.
        ui(()->activity.play("/keremflix/api/stream/10514","Hızlı ve Öfkeli",0,"",10514,null));
        Object player=field(activity,"player");waitField(player,"fullscreen",true);check(activity.getRequestedOrientation()==android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE,"Automatic landscape requested");Thread.sleep(1500);
        View frame=(View)field(player,"frame");check(frame.getWidth()>frame.getHeight(),"Automatic landscape applied with rotation lock");check((activity.getWindow().getDecorView().getSystemUiVisibility()&View.SYSTEM_UI_FLAG_FULLSCREEN)!=0,"Immersive fullscreen applied");capture("automatic-landscape");
        reflectUi(player,"toggleFullscreen");Thread.sleep(1000);
        waitField(player,"ready",true);waitField(player,"subtitleDiscoveryDone",true);reflectUi(player,"toggle");reflectUi(player,"subtitleMenu");
        PopupWindow popup=(PopupWindow)field(player,"menu");View menu=popup.getContentView();await(menu,"tur · #3");View unsupported=await(menu,"PGS (görüntü tabanlı, desteklenmiyor)");check(!unsupported.isEnabled(),"Bitmap subtitle must be disabled");capture("subtitle-menu-portrait");click(menu,"tur · #3");waitField(player,"selectedSubtitle","2");Thread.sleep(1200);check(!((java.util.List<?>)field(player,"cues")).isEmpty(),"VTT cues parsed");
        Object caption=field(player,"subtitle");check(field(caption,"text").toString().contains("İkinci satır"),"Multiline subtitle rendered");
        reflectUi(player,"subtitleMenu");popup=(PopupWindow)field(player,"menu");menu=popup.getContentView();click(menu,"Altyazı yazısını büyüt");check(field(player,"subtitleSize").equals(28),"Font increased");
        View position=await(menu,"Altyazı dikey konumu");ui(()->{((SeekBar)position).setProgress(0);try{Field f=player.getClass().getDeclaredField("subtitlePosition");f.setAccessible(true);f.setInt(player,0);call(player,"saveSubtitlePreferences");}catch(Exception e){throw new RuntimeException(e);}});
        click(menu,"Siyah arka plan");check(field(player,"subtitleBackground").equals(false),"Background toggled");dismiss(player);hideControls(player);capture("subtitle-top-portrait");
        ui(()->activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));Thread.sleep(1500);hideControls(player);capture("subtitle-top-landscape");position(player,100);capture("subtitle-bottom-landscape");
        ui(()->activity.play("/keremflix/api/stream/10514","Hızlı ve Öfkeli",0,"",10514,null));Object reopened=field(activity,"player");
        check(field(reopened,"subtitleSize").equals(28)&&field(reopened,"subtitlePosition").equals(100)&&field(reopened,"subtitleBackground").equals(false),"Preferences survived player recreation");
        waitField(reopened,"ready",true);waitField(reopened,"subtitleDiscoveryDone",true);reflectUi(reopened,"toggle");reflectUi(reopened,"subtitleMenu");PopupWindow again=(PopupWindow)field(reopened,"menu");click(again.getContentView(),"Varsayılana dön");
        check(field(reopened,"subtitleSize").equals(26)&&field(reopened,"subtitlePosition").equals(85)&&field(reopened,"subtitleBackground").equals(true),"Defaults restored");capture("subtitle-menu-landscape");
        click(again.getContentView(),"eng · #4");waitField(reopened,"subtitleError","Altyazı yüklenemedi. Başka bir altyazı seçebilirsiniz.");reflectUi(reopened,"subtitleMenu");again=(PopupWindow)field(reopened,"menu");click(again.getContentView(),"Kapalı");check(field(reopened,"selectedSubtitle")==null,"Subtitles disabled");
        ui(()->activity.hub());check(activity.getRequestedOrientation()==android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED,"Orientation released after leaving player");check((activity.getWindow().getDecorView().getSystemUiVisibility()&View.SYSTEM_UI_FLAG_FULLSCREEN)==0,"System bars restored");
        result.putString("stream","PASS metadata/reset, automatic landscape/fullscreen, orientation cleanup, supported streams, multiline VTT, settings, letterbox positions, persistence, defaults and load failure");
    }catch(Throwable error){status=1;result.putString("failure",android.util.Log.getStackTraceString(error));}finally{
        if(activity!=null){ui(()->activity.hub());if(prefs!=null){SharedPreferences.Editor edit=prefs.edit();if(original==null)edit.remove("server");else edit.putString("server",original);edit.commit();}}
    }finish(status,result);}
}
