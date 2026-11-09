package com.keremhub.app;

import android.app.*;
import android.content.pm.ActivityInfo;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.*;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.*;
import android.util.Rational;
import android.view.*;
import android.widget.*;
import java.net.HttpURLConnection;
import java.util.*;
import java.util.regex.*;
import org.json.*;
import android.text.*;

/** Native fixed-inset player matching Keremflix's responsive control surface. */
public final class PlayerScreen {
    private final MainActivity a;
    private final String stream,title,progress;
    private final double start;
    private final int id;
    private final Runnable previous,next;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayList<Cue> cues=new ArrayList<>();
    private StreamVideoView video;
    private MediaPlayer media;
    private FrameLayout frame,overlay;
    private LinearLayout top,bottom,buttons,episodes;
    private TextView remaining,feedback;
    private Caption subtitle;
    private final ArrayList<SubtitleTrack> subtitleTracks=new ArrayList<>();
    private String selectedSubtitle,subtitleError;
    private boolean subtitleDiscoveryDone,subtitleDiscoveryFailed,subtitleBackground=true;
    private int subtitleSize=26,subtitlePosition=85,subtitleGeneration;
    private PopupWindow menu;
    private boolean subtitleMenuOpen;
    private SeekBar seek;
    private Glyph play,center,mute;
    private boolean switching;
    private long loadStarted;
    private boolean ready,disposed,dragging,shown=true,holding,fullscreen,pip,muted;
    private float rate=1,volume=1;
    private long lastSave;
    private final Runnable hide=()->{if(ready&&video.isPlaying()&&!dragging&&!holding&&(menu==null||!menu.isShowing()))controls(false);};
    private final Runnable clearHint=()->{if(feedback!=null)feedback.setVisibility(View.GONE);};

    PlayerScreen(MainActivity a,String stream,String title,double start,String progress,int id,Runnable previous,Runnable next){this.a=a;this.stream=stream;this.title=title;this.start=start;this.progress=progress;this.id=id;this.previous=previous;this.next=next;}

    public void show(){
        a.theme(Color.BLACK,0xff181818,Color.WHITE,0xffb3b3b3,0xffe50914);
        a.page(title,"");a.remember(()->new PlayerScreen(a,stream,title,position()/1000.0,progress,id,previous,next).show());
        a.setPlayer(this);a.onPageCleanup(this::dispose);a.root.removeAllViews();
        frame=new FrameLayout(a);frame.setBackgroundColor(Color.BLACK);a.root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));
        video=new StreamVideoView(a);frame.addView(video,new FrameLayout.LayoutParams(-1,-1,Gravity.CENTER));
        View surface=new View(a);surface.setContentDescription("Video; tek dokun kontroller, çift dokun ±10 saniye, basılı tut 2×");frame.addView(surface,new FrameLayout.LayoutParams(-1,-1));gestures(surface);
        android.content.SharedPreferences preferences=a.getSharedPreferences("keremflix.subtitle-preferences.v1",0);
        subtitleBackground=preferences.getBoolean("background",true);subtitleSize=Math.max(14,Math.min(56,preferences.getInt("fontSize",26)));subtitlePosition=Math.max(0,Math.min(100,preferences.getInt("position",85)));
        subtitle=new Caption();frame.addView(subtitle,new FrameLayout.LayoutParams(-1,-1));
        overlay=new FrameLayout(a);frame.addView(overlay,new FrameLayout.LayoutParams(-1,-1));
        top=a.row();top.setPadding(a.dp(16),a.dp(12),a.dp(16),a.dp(32));top.setBackground(gradient(true));
        add(top,"back","Geri",a::back);TextView heading=a.text(title,21,Color.WHITE);heading.setTypeface(a.font("inter",500));heading.setSingleLine(true);heading.setEllipsize(android.text.TextUtils.TruncateAt.END);LinearLayout.LayoutParams hl=new LinearLayout.LayoutParams(0,-2,1);hl.leftMargin=a.dp(12);top.addView(heading,hl);
        View hub=Ui.icon(a,"home",44,Color.WHITE,a::hub);hub.setContentDescription("Ana hub’a dön");hub.setTooltipText("Keremhub ana sayfa");top.addView(hub,new LinearLayout.LayoutParams(a.dp(44),a.dp(44)));
        overlay.addView(top,new FrameLayout.LayoutParams(-1,-2,Gravity.TOP));
        center=new Glyph("pause","Ortadan oynat / duraklat",this::toggle);GradientDrawable circle=a.shape(0xa6000000,50);circle.setStroke(a.dp(1),0x40ffffff);center.setBackground(circle);overlay.addView(center,new FrameLayout.LayoutParams(a.dp(64),a.dp(64),Gravity.CENTER));
        bottom=a.column();bottom.setPadding(a.dp(16),a.dp(52),a.dp(16),a.dp(12));bottom.setBackground(gradient(false));LinearLayout timeline=a.row();bottom.addView(timeline);
        seek=new SeekBar(a);seek.setMax(10000);seek.setPadding(0,0,0,0);seek.setProgressTintList(ColorStateList.valueOf(0xffe50914));seek.setSecondaryProgressTintList(ColorStateList.valueOf(0x99ffffff));seek.setProgressBackgroundTintList(ColorStateList.valueOf(0x40ffffff));seek.setThumb(new ColorDrawable(Color.TRANSPARENT));seek.setContentDescription("Video ilerlemesi");timeline.addView(seek,new LinearLayout.LayoutParams(0,a.dp(32),1));
        remaining=a.text("0:00",14,Color.WHITE);remaining.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);timeline.addView(remaining,new LinearLayout.LayoutParams(a.dp(90),a.dp(32)));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){dragging=true;handler.removeCallbacks(hide);}public void onStopTrackingTouch(SeekBar s){if(ready)video.seekTo((int)((long)duration()*s.getProgress()/10000));dragging=false;wake();}public void onProgressChanged(SeekBar s,int v,boolean user){if(user&&ready)remaining.setText(clock((int)((long)duration()*(10000-v)/10000)));}});
        episodes=a.row();bottom.addView(episodes);buildEpisodeButtons();buttons=a.row();bottom.addView(buttons);rebuildButtons();overlay.addView(bottom,new FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM));
        feedback=a.text("Video hazırlanıyor…",14,Color.WHITE);feedback.setGravity(Gravity.CENTER);feedback.setPadding(a.dp(16),a.dp(10),a.dp(16),a.dp(10));feedback.setBackground(a.shape(0xd9000000,24));FrameLayout.LayoutParams fl=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER_HORIZONTAL|Gravity.TOP);fl.topMargin=a.dp(96);frame.addView(feedback,fl);feedback.setOnClickListener(v->{if(!ready)load();});
        frame.setFocusableInTouchMode(true);frame.requestFocus();frame.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{if(r-l!=or-ol)configurationChanged();});
        video.setOnPreparedListener(mp->{if(disposed)return;media=mp;ready=true;android.util.Log.i("KeremhubPlayer","Prepared episode "+id+" in "+(SystemClock.elapsedRealtime()-loadStarted)+" ms");mp.setOnBufferingUpdateListener((m,p)->seek.setSecondaryProgress(p*100));if(start>0)video.seekTo((int)(start*1000));video.start();applyVolume();updatePlaying();feedback.setVisibility(View.GONE);wake();});
        video.setOnInfoListener((mp,what,extra)->{if(disposed)return true;if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START){android.util.Log.i("KeremhubPlayer","First frame episode "+id+" in "+(SystemClock.elapsedRealtime()-loadStarted)+" ms");feedback.setVisibility(View.GONE);}if(what==MediaPlayer.MEDIA_INFO_BUFFERING_START)hint("Yükleniyor…",false);if(what==MediaPlayer.MEDIA_INFO_BUFFERING_END)feedback.setVisibility(View.GONE);return false;});
        video.setOnCompletionListener(mp->{save();updatePlaying();controls(true);if(next!=null)new AlertDialog.Builder(a).setTitle("Bölüm tamamlandı").setPositiveButton("Sonraki bölüm",(d,w)->goNext()).setNegativeButton("Kapat",null).show();});
        video.setOnErrorListener((mp,what,extra)->{ready=false;a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);hint("Video açılamadı ("+what+" / "+extra+"). Yeniden denemek için dokun.",false);controls(true);return true;});
        load();discoverSubtitles();handler.post(tick);
    }

    private GradientDrawable gradient(boolean upper){return new GradientDrawable(upper?GradientDrawable.Orientation.TOP_BOTTOM:GradientDrawable.Orientation.BOTTOM_TOP,new int[]{0xe6000000,0x00000000});}
    private Glyph add(LinearLayout row,String icon,String label,Runnable run){Glyph v=new Glyph(icon,label,run);row.addView(v,new LinearLayout.LayoutParams(a.dp(40),a.dp(44)));return v;}
    private void rebuildButtons(){buttons.removeAllViews();play=add(buttons,"pause","Oynat / duraklat",this::toggle);add(buttons,"rewind","10 sn geri",()->seekBy(-10000));add(buttons,"forward","10 sn ileri",()->seekBy(10000));mute=add(buttons,muted?"muted":"volume","Sessiz / sesi aç",()->{muted=!muted;applyVolume();wake();});buttons.addView(new View(a),new LinearLayout.LayoutParams(0,1,1));add(buttons,"captions","Altyazı",this::subtitleMenu);Glyph speed=add(buttons,"speed","Oynatma hızı",this::speedMenu);speed.setTooltipText("Hız · basılı tut: ses, PiP ve kısayollar");speed.setOnLongClickListener(v->{options();return true;});add(buttons,"fullscreen","Tam ekran",this::toggleFullscreen);if(ready)updatePlaying();}
    public void configurationChanged(){if(disposed||center==null)return;if(menu!=null)menu.dismiss();boolean wide=frame.getWidth()>a.dp(640);int side=a.dp(wide?24:16);top.setPadding(side,a.dp(12),side,a.dp(32));bottom.setPadding(side,a.dp(52),side,a.dp(12));FrameLayout.LayoutParams cp=(FrameLayout.LayoutParams)center.getLayoutParams();cp.width=cp.height=a.dp(wide?80:64);center.setLayoutParams(cp);}
    private void load(){if(disposed)return;ready=false;media=null;loadStarted=SystemClock.elapsedRealtime();hint("Video hazırlanıyor…",false);video.setVideoURI(Uri.parse(a.api.url(stream)));}
    private int duration(){try{return ready?Math.max(0,video.getDuration()):0;}catch(Exception e){return 0;}}
    private int position(){try{return ready?Math.max(0,video.getCurrentPosition()):(int)(start*1000);}catch(Exception e){return (int)(start*1000);}}
    private void toggle(){if(!ready)return;endHold();if(video.isPlaying()){video.pause();save();}else{if(position()>=duration()-500)video.seekTo(0);video.start();}updatePlaying();wake();}
    private void updatePlaying(){boolean running=ready&&video.isPlaying();if(play!=null){play.name=running?"pause":"play";play.invalidate();}center.name=running?"pause":"play";center.invalidate();if(running)a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
    private void seekBy(int delta){if(ready){video.seekTo((int)Math.max(0,Math.min((long)duration(),(long)position()+delta)));hint((delta>0?"+":"−")+Math.abs(delta/1000)+" sn",true);wake();}}
    private void buildEpisodeButtons(){
        if(previous==null&&next==null){episodes.setVisibility(View.GONE);return;}
        episodeButton("previous","Önceki bölüm",previous,()->goEpisode(previous));
        episodeButton("next","Sonraki bölüm",next,this::goNext);
    }
    private void episodeButton(String icon,String label,Runnable target,Runnable action){
        LinearLayout button=a.row();button.setGravity(Gravity.CENTER);button.setMinimumHeight(a.dp(48));
        button.setContentDescription(label);button.setEnabled(target!=null);button.setAlpha(target==null?.35f:1);
        Glyph glyph=new Glyph(icon,label,action);glyph.setEnabled(target!=null);button.addView(glyph,new LinearLayout.LayoutParams(a.dp(32),a.dp(44)));
        TextView text=a.text(label,13,Color.WHITE);button.addView(text);episodes.addView(button,new LinearLayout.LayoutParams(0,a.dp(48),1));
        if(target!=null)button.setOnClickListener(v->action.run());
    }
    private void goNext(){goEpisode(next);}
    private void goEpisode(Runnable target){if(disposed||switching||target==null)return;switching=true;save();target.run();handler.postDelayed(()->switching=false,1500);}
    boolean isFullscreen(){return fullscreen;}
    void restoreFullscreen(){if(!fullscreen)toggleFullscreen();}
    private void applyVolume(){if(media!=null&&ready)media.setVolume(muted?0:volume,muted?0:volume);if(mute!=null){mute.name=muted||volume==0?"muted":"volume";mute.invalidate();}}
    private void speed(float value,boolean remember){if(!ready||media==null)return;try{boolean playing=video.isPlaying();media.setPlaybackParams(media.getPlaybackParams().setSpeed(value));if(!playing)video.pause();if(remember)rate=value;hint(value+"× hız",true);}catch(Exception e){hint("Bu hız bu dosyada desteklenmiyor.",true);}}
    private void endHold(){if(holding){holding=false;speed(rate,false);}}
    private void options(){handler.removeCallbacks(hide);new AlertDialog.Builder(a).setTitle("Oynatma seçenekleri").setItems(new String[]{"Ses parçası","Küçük pencere (PiP)","Kısayollar"},(d,n)->{if(n==0)tracks(MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO);else if(n==1)pip();else help();}).setOnDismissListener(d->wake()).show();}
    private void tracks(int type){if(media==null||!ready)return;try{MediaPlayer.TrackInfo[] info=media.getTrackInfo();ArrayList<Integer> ids=new ArrayList<>();ArrayList<String> labels=new ArrayList<>();if(type!=MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO){ids.add(-1);labels.add("Kapalı");}for(int i=0;i<info.length;i++)if(info[i].getTrackType()==type||(type==MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_SUBTITLE&&info[i].getTrackType()==MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_TIMEDTEXT)){ids.add(i);labels.add(info[i].getLanguage()+" · Parça "+(i+1));}if(labels.isEmpty()){hint("Başka parça bulunmuyor.",true);return;}a.choose("Parça seç",labels.toArray(new String[0]),n->{try{int index=ids.get(n);if(index>=0)media.selectTrack(index);else{int selected=media.getSelectedTrack(type);if(selected>=0)media.deselectTrack(selected);}}catch(Exception e){hint("Parça desteklenmiyor.",true);}});}catch(Exception e){hint("Parça bilgisi alınamadı.",true);}}
    private void wake(){if(disposed||pip)return;controls(true);handler.removeCallbacks(hide);handler.postDelayed(hide,4000);}
    private void controls(boolean show){shown=show;overlay.setVisibility(show&&!pip?View.VISIBLE:View.GONE);}
    private void hint(String text,boolean temporary){if(disposed||feedback==null)return;feedback.setText(text);feedback.setVisibility(pip?View.GONE:View.VISIBLE);handler.removeCallbacks(clearHint);if(temporary)handler.postDelayed(clearHint,1600);}
    private void gestures(View surface){GestureDetector detector=new GestureDetector(a,new GestureDetector.SimpleOnGestureListener(){public boolean onDown(MotionEvent e){return true;}public boolean onSingleTapConfirmed(MotionEvent e){if(shown)controls(false);else wake();return true;}public boolean onDoubleTap(MotionEvent e){seekBy(e.getX()<frame.getWidth()/2f?-10000:10000);return true;}public void onLongPress(MotionEvent e){if(ready&&video.isPlaying()){holding=true;handler.removeCallbacks(hide);speed(2,false);}}public boolean onScroll(MotionEvent down,MotionEvent now,float dx,float dy){if(down==null||holding)return false;if(Math.abs(now.getY()-down.getY())<a.dp(18)||Math.abs(now.getX()-down.getX())>Math.abs(now.getY()-down.getY()))return false;if(down.getX()<frame.getWidth()/2f){WindowManager.LayoutParams lp=a.getWindow().getAttributes();float value=lp.screenBrightness<0?.5f:lp.screenBrightness;lp.screenBrightness=Math.max(.02f,Math.min(1,value+dy/Math.max(1,frame.getHeight())));a.getWindow().setAttributes(lp);hint("Parlaklık %"+Math.round(lp.screenBrightness*100),true);}else{volume=Math.max(0,Math.min(1,volume+dy/Math.max(1,frame.getHeight())));muted=false;applyVolume();hint("Ses %"+Math.round(volume*100),true);}return true;}});surface.setOnTouchListener((v,e)->{detector.onTouchEvent(e);if(e.getActionMasked()==MotionEvent.ACTION_UP||e.getActionMasked()==MotionEvent.ACTION_CANCEL){endHold();if(shown)wake();}return true;});}
    private void toggleFullscreen(){fullscreen=!fullscreen;a.setRequestedOrientation(fullscreen?ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);a.getWindow().getDecorView().setSystemUiVisibility(fullscreen?View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:0);wake();}
    public boolean handleBack(){if(fullscreen){toggleFullscreen();return true;}return false;}
    public boolean key(int code,KeyEvent e){if(e.getAction()!=KeyEvent.ACTION_DOWN||e.isCtrlPressed()||e.isAltPressed())return false;switch(code){case KeyEvent.KEYCODE_SPACE:case KeyEvent.KEYCODE_K:case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:if(e.getRepeatCount()==0)toggle();break;case KeyEvent.KEYCODE_J:case KeyEvent.KEYCODE_DPAD_LEFT:seekBy(-10000);break;case KeyEvent.KEYCODE_L:case KeyEvent.KEYCODE_DPAD_RIGHT:seekBy(10000);break;case KeyEvent.KEYCODE_M:muted=!muted;applyVolume();break;case KeyEvent.KEYCODE_DPAD_UP:volume=Math.min(1,volume+.1f);muted=false;applyVolume();break;case KeyEvent.KEYCODE_DPAD_DOWN:volume=Math.max(0,volume-.1f);applyVolume();break;case KeyEvent.KEYCODE_C:subtitleMenu();break;case KeyEvent.KEYCODE_F:toggleFullscreen();break;case KeyEvent.KEYCODE_N:case KeyEvent.KEYCODE_MEDIA_NEXT:goNext();break;case KeyEvent.KEYCODE_MEDIA_PREVIOUS:goEpisode(previous);break;case KeyEvent.KEYCODE_P:pip();break;case KeyEvent.KEYCODE_ESCAPE:return handleBack();default:if(code>=KeyEvent.KEYCODE_0&&code<=KeyEvent.KEYCODE_9&&ready)video.seekTo((int)((long)duration()*(code-KeyEvent.KEYCODE_0)/10));else return false;}wake();return true;}
    private void help(){new AlertDialog.Builder(a).setTitle("Oynatma kısayolları").setMessage("Tek dokun: kontroller\nÇift dokun: sol −10 sn / sağ +10 sn\nBasılı tut: geçici 2×\nDikey kaydır: solda parlaklık / sağda ses\nBoşluk / K: oynat-duraklat\nJ / L / ← / →: ±10 saniye\n↑ / ↓: ses · M: sessiz\nC: altyazı · F: tam ekran · P: PiP\n0–9: yüzdeye git · N: sonraki bölüm").setPositiveButton("Kapat",null).show();}
    public void pip(){if(disposed||!ready)return;try{int w=media.getVideoWidth(),h=media.getVideoHeight();float r=w>0&&h>0?w/(float)h:16/9f;r=Math.max(1/2.39f,Math.min(2.39f,r));a.enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(Math.round(r*1000),1000)).build());}catch(Exception e){hint("Bu cihaz küçük pencereyi desteklemiyor.",true);}}
    public void pipModeChanged(boolean active){if(disposed)return;pip=active;overlay.setVisibility(active?View.GONE:View.VISIBLE);feedback.setVisibility(View.GONE);if(!active)wake();}
    public void pauseForBackground(boolean activePip){save();endHold();if(!activePip&&ready){video.pause();updatePlaying();controls(true);}}
    private final Runnable tick=new Runnable(){public void run(){if(disposed)return;if(ready){int pos=position(),dur=duration();if(!dragging){seek.setProgress(dur>0?(int)((long)pos*10000/dur):0);remaining.setText(clock(Math.max(0,dur-pos)));}if(selectedSubtitle!=null){StringBuilder text=new StringBuilder();for(Cue cue:cues)if(pos>=cue.from&&pos<cue.to){if(text.length()>0)text.append("\n");text.append(cue.text);}subtitle.setText(text.toString());}updatePlaying();if(video.isPlaying()&&System.currentTimeMillis()-lastSave>=10000)save();}handler.postDelayed(this,400);}};
    private String clock(int ms){int s=Math.max(0,ms/1000);return s>=3600?String.format(Locale.ROOT,"%d:%02d:%02d",s/3600,s/60%60,s%60):String.format(Locale.ROOT,"%d:%02d",s/60,s%60);}
    private void save(){if(disposed||!ready||progress==null||progress.trim().isEmpty()||duration()<=0)return;lastSave=System.currentTimeMillis();double seconds=position()/1000.0,duration=duration()/1000.0;a.api.io.execute(()->{try{a.api.sync("POST",progress,a.obj("episodeId",id,"seconds",seconds,"duration",duration));}catch(Exception e){android.util.Log.w("KeremhubPlayer","Progress retained only in current playback",e);}});}
    private void dispose(){if(disposed)return;save();disposed=true;subtitleGeneration++;if(menu!=null)menu.dismiss();handler.removeCallbacksAndMessages(null);if(video!=null)video.stopPlayback();a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);WindowManager.LayoutParams lp=a.getWindow().getAttributes();lp.screenBrightness=-1;a.getWindow().setAttributes(lp);a.getWindow().getDecorView().setSystemUiVisibility(0);}
    private static final class Cue{final int from,to;final String text;Cue(int f,int t,String s){from=f;to=t;text=s;}}
    private int timestamp(String text){double value=0;for(String part:text.replace(',','.').split(":"))value=value*60+Double.parseDouble(part);return (int)(value*1000);}
    private static final class SubtitleTrack {
        final String id,label,path;final boolean supported;
        SubtitleTrack(String id,String label,String path,boolean supported){this.id=id;this.label=label;this.path=path;this.supported=supported;}
    }
    private void discoverSubtitles(){
        if(!stream.contains("/keremflix/")||id<=0){subtitleDiscoveryDone=true;return;}
        a.api.io.execute(()->{
            ArrayList<SubtitleTrack> found=new ArrayList<>();boolean failed=false;
            try{HttpURLConnection c=a.api.connection("/keremflix/api/subtitle/"+id,"HEAD");try{if(c.getResponseCode()==200)found.add(new SubtitleTrack("external","Harici altyazı","/keremflix/api/subtitle/"+id,true));}finally{c.disconnect();}}catch(Exception ignored){}
            try{JSONObject data=(JSONObject)a.api.sync("GET","/keremflix/api/subtitles/"+id,null);JSONArray streams=data.optJSONArray("streams");if(streams==null)throw new Exception("Invalid subtitle response");
                for(int i=0;i<streams.length();i++){JSONObject track=streams.getJSONObject(i);String index=String.valueOf(track.getInt("index"));found.add(new SubtitleTrack(index,track.optString("label",track.optString("language","und")+" · #"+index),"/keremflix/api/subtitles/"+id+"?stream="+index,track.optBoolean("supported")));}
            }catch(Exception error){failed=true;}
            boolean error=failed;a.api.main.post(()->{if(disposed)return;subtitleTracks.addAll(found);subtitleDiscoveryDone=true;subtitleDiscoveryFailed=error;if(subtitleMenuOpen&&menu!=null&&menu.isShowing())subtitleMenu();});
        });
    }
    private void selectSubtitle(SubtitleTrack track){
        selectedSubtitle=track==null?null:track.id;subtitleError=null;cues.clear();subtitle.setText("");int token=++subtitleGeneration;
        if(menu!=null)menu.dismiss();if(track==null)return;hint("Altyazı yükleniyor…",false);
        a.api.io.execute(()->{ArrayList<Cue> parsed=new ArrayList<>();String error=null;
            try{HttpURLConnection c=a.api.connection(track.path,"GET");try{if(c.getResponseCode()!=200)throw new Exception();String raw=new String(Api.read(c.getInputStream()),java.nio.charset.StandardCharsets.UTF_8).replace("\r","");
                Matcher m=Pattern.compile("(?m)([\\d:.,]+)\\s+-->\\s+([\\d:.,]+)[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*\\n|\\z)").matcher(raw);
                while(m.find())parsed.add(new Cue(timestamp(m.group(1)),timestamp(m.group(2)),Html.fromHtml(m.group(3).trim().replace("\n","<br>"),0).toString().trim()));
            }finally{c.disconnect();}}catch(Exception e){error="Altyazı yüklenemedi. Başka bir altyazı seçebilirsiniz.";}
            String failure=error;a.api.main.post(()->{if(disposed||token!=subtitleGeneration)return;cues.addAll(parsed);subtitleError=failure;if(failure!=null)hint(failure,false);else feedback.setVisibility(View.GONE);});
        });
    }
    private LinearLayout popup(){
        if(menu!=null)menu.dismiss();handler.removeCallbacks(hide);controls(true);
        LinearLayout content=a.column();content.setPadding(0,a.dp(4),0,a.dp(4));content.setBackground(a.shape(0xf2181818,6));
        ScrollView scroll=new ScrollView(a);scroll.setFillViewport(false);scroll.addView(content);scroll.setBackground(a.shape(0xf2181818,6));
        menu=new PopupWindow(scroll,a.dp(Math.min(352,Math.max(240,(int)(frame.getWidth()/a.getResources().getDisplayMetrics().density)-48))),-2,true);menu.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));menu.setOutsideTouchable(true);menu.setElevation(a.dp(12));menu.setOnDismissListener(this::wake);
        scroll.setOnTouchListener((v,e)->{handler.removeCallbacks(hide);return false;});return content;
    }
    private void showPopup(LinearLayout content){
        int max=Math.max(a.dp(100),(int)(frame.getHeight()*.65f));content.measure(View.MeasureSpec.makeMeasureSpec(menu.getWidth(),View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));menu.setHeight(Math.min(max,content.getMeasuredHeight()));
        menu.showAtLocation(frame,Gravity.RIGHT|Gravity.BOTTOM,a.dp(24),Math.min(a.dp(90),Math.max(0,frame.getHeight()-menu.getHeight())));
    }
    private TextView menuItem(LinearLayout parent,String text,Runnable click){TextView item=a.text(text,16,Color.WHITE);item.setPadding(a.dp(16),a.dp(8),a.dp(16),a.dp(8));item.setMinHeight(a.dp(40));item.setGravity(Gravity.CENTER_VERTICAL);parent.addView(item,new LinearLayout.LayoutParams(-1,-2));if(click!=null){item.setFocusable(true);item.setOnClickListener(v->click.run());}return item;}
    private void speedMenu(){subtitleMenuOpen=false;LinearLayout content=popup();float[] values={.5f,.75f,1,1.25f,1.5f,2};for(float value:values)menuItem(content,(value==1?"Normal":value+"x")+(rate==value?"  ●":""),()->{speed(value,true);menu.dismiss();});showPopup(content);}
    private void subtitleMenu(){
        subtitleMenuOpen=true;LinearLayout content=popup();menuItem(content,"Kapalı"+(selectedSubtitle==null?"  ●":""),()->selectSubtitle(null));
        for(SubtitleTrack track:subtitleTracks){TextView item=menuItem(content,track.label+(!track.supported?" (görüntü tabanlı, desteklenmiyor)":track.id.equals(selectedSubtitle)?"  ●":""),()->selectSubtitle(track));item.setEnabled(track.supported);item.setAlpha(track.supported?1:.4f);}
        if(subtitleTracks.isEmpty())menuItem(content,!subtitleDiscoveryDone?"Altyazılar yükleniyor…":subtitleDiscoveryFailed?"Altyazılar okunamadı":"Altyazı bulunamadı",null);
        if(subtitleError!=null)menuItem(content,subtitleError,null);
        View line=new View(a);line.setBackgroundColor(0x26ffffff);content.addView(line,new LinearLayout.LayoutParams(-1,a.dp(1)));
        LinearLayout settings=a.column();settings.setPadding(a.dp(16),a.dp(16),a.dp(16),a.dp(16));content.addView(settings);TextView heading=a.text("Altyazı ayarları",16,Color.WHITE);heading.setTypeface(a.font("inter",600));settings.addView(heading);a.space(settings,16);
        LinearLayout backgroundRow=a.row();settings.addView(backgroundRow,new LinearLayout.LayoutParams(-1,a.dp(40)));TextView backgroundLabel=a.text("Siyah arka plan",16,Color.WHITE);backgroundRow.addView(backgroundLabel,new LinearLayout.LayoutParams(0,-2,1));CheckBox background=new CheckBox(a);background.setContentDescription("Siyah arka plan");background.setButtonTintList(new ColorStateList(new int[][]{new int[]{android.R.attr.state_checked},new int[]{}},new int[]{0xffe50914,0xffdddddd}));background.setChecked(subtitleBackground);backgroundRow.addView(background,new LinearLayout.LayoutParams(a.dp(28),a.dp(40)));backgroundLabel.setOnClickListener(v->background.performClick());background.setOnCheckedChangeListener((v,checked)->{subtitleBackground=checked;saveSubtitlePreferences();});
        a.space(settings,12);LinearLayout sizing=a.row();settings.addView(sizing);TextView label=a.text("Yazı boyutu",16,Color.WHITE);sizing.addView(label,new LinearLayout.LayoutParams(0,-2,1));
        TextView smaller=a.text("A−",16,Color.WHITE),size=a.text(subtitleSize+"px",14,Color.WHITE),larger=a.text("A+",16,Color.WHITE);
        for(TextView v:new TextView[]{smaller,size,larger}){v.setGravity(Gravity.CENTER);sizing.addView(v,new LinearLayout.LayoutParams(a.dp(42),a.dp(36)));}smaller.setBackground(a.shape(0x1affffff,4));larger.setBackground(a.shape(0x1affffff,4));smaller.setContentDescription("Altyazı yazısını küçült");larger.setContentDescription("Altyazı yazısını büyüt");
        Runnable refresh=()->{size.setText(subtitleSize+"px");smaller.setEnabled(subtitleSize>14);smaller.setAlpha(subtitleSize>14?1:.3f);larger.setEnabled(subtitleSize<56);larger.setAlpha(subtitleSize<56?1:.3f);};refresh.run();
        smaller.setOnClickListener(v->{subtitleSize=Math.max(14,subtitleSize-2);saveSubtitlePreferences();refresh.run();});larger.setOnClickListener(v->{subtitleSize=Math.min(56,subtitleSize+2);saveSubtitlePreferences();refresh.run();});
        a.space(settings,16);settings.addView(a.text("Dikey konum",16,Color.WHITE));a.space(settings,8);settings.addView(a.text("Siyah boşluklar dahil tüm ekran",12,0xffe5e5e5));
        SeekBar position=new SeekBar(a);position.setMax(100);position.setProgress(subtitlePosition);position.setContentDescription("Altyazı dikey konumu");position.setProgressTintList(ColorStateList.valueOf(0xffe50914));position.setThumbTintList(ColorStateList.valueOf(0xffe50914));settings.addView(position,new LinearLayout.LayoutParams(-1,a.dp(40)));position.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}public void onProgressChanged(SeekBar s,int value,boolean user){if(user){subtitlePosition=value;saveSubtitlePreferences();}}});
        LinearLayout ends=a.row();settings.addView(ends);ends.addView(a.text("Üst",14,0xffe5e5e5),new LinearLayout.LayoutParams(0,-2,1));ends.addView(a.text("Alt",14,0xffe5e5e5));
        TextView reset=menuItem(settings,"Varsayılana dön",()->{subtitleBackground=true;subtitleSize=26;subtitlePosition=85;background.setChecked(true);position.setProgress(85);refresh.run();saveSubtitlePreferences();});reset.setPaintFlags(reset.getPaintFlags()|Paint.UNDERLINE_TEXT_FLAG);showPopup(content);
    }
    private void saveSubtitlePreferences(){a.getSharedPreferences("keremflix.subtitle-preferences.v1",0).edit().putBoolean("background",subtitleBackground).putInt("fontSize",subtitleSize).putInt("position",subtitlePosition).apply();subtitle.invalidate();}

    /** Captions use the entire player shell, including letterbox bars. */
    private final class Caption extends View {
        private String text="";private final TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);private final Paint box=new Paint(Paint.ANTI_ALIAS_FLAG);
        Caption(){super(a);setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);}
        void setText(String value){if(!text.equals(value)){text=value;invalidate();}}
        @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);if(text.isEmpty())return;
            paint.setColor(Color.WHITE);paint.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));paint.setTextSize(a.dp(subtitleSize));if(subtitleBackground)paint.clearShadowLayer();else paint.setShadowLayer(a.dp(3),0,a.dp(1),Color.BLACK);
            int width=Math.max(1,Math.round(getWidth()*.92f)-a.dp(12));StaticLayout layout=StaticLayout.Builder.obtain(text,0,text.length(),paint,width).setAlignment(Layout.Alignment.ALIGN_CENTER).setIncludePad(false).setLineSpacing(0,1.35f).build();
            float height=layout.getHeight(),y=Math.max(0,Math.min(getHeight()-height,getHeight()*subtitlePosition/100f-height/2));canvas.save();canvas.clipRect(0,0,getWidth(),getHeight());canvas.translate((getWidth()-width)/2f,y);
            if(subtitleBackground){box.setColor(0xd9000000);for(int i=0;i<layout.getLineCount();i++)canvas.drawRoundRect(layout.getLineLeft(i)-a.dp(6),layout.getLineTop(i)-a.dp(2),layout.getLineRight(i)+a.dp(6),layout.getLineBottom(i)+a.dp(2),a.dp(2),a.dp(2),box);}layout.draw(canvas);canvas.restore();
        }
    }

    /** Canvas vectors, independent of the device's emoji/font rendering. */
    private final class Glyph extends View{
        String name;final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        Glyph(String name,String label,Runnable run){super(a);this.name=name;setContentDescription(label);setFocusable(true);setOnClickListener(v->run.run());}
        void line(Canvas c,float... xy){Path path=new Path();path.moveTo(xy[0],xy[1]);for(int i=2;i<xy.length;i+=2)path.lineTo(xy[i],xy[i+1]);c.drawPath(path,p);}
        @Override protected void onDraw(Canvas c){super.onDraw(c);float size=a.dp(this==center?32:28);c.save();c.translate((getWidth()-size)/2,(getHeight()-size)/2);c.scale(size/24,size/24);p.setColor(Color.WHITE);p.setStrokeWidth(1.9f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);p.setStyle(Paint.Style.STROKE);switch(name){case "play":p.setStyle(Paint.Style.FILL);Path triangle=new Path();triangle.moveTo(7,3);triangle.lineTo(21,12);triangle.lineTo(7,21);triangle.close();c.drawPath(triangle,p);break;case "pause":p.setStyle(Paint.Style.FILL);c.drawRoundRect(5,3,10,21,1,1,p);c.drawRoundRect(14,3,19,21,1,1,p);break;case "back":line(c,13,4,5,12,13,20);line(c,5,12,22,12);break;case "rewind":case "forward":boolean f=name.equals("forward");if(f){c.save();c.scale(-1,1,12,12);}c.drawArc(3,4,21,22,-120,300,false,p);line(c,9,1,5,5,10,7);if(f)c.restore();p.setStyle(Paint.Style.FILL);p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(8);p.setTextAlign(Paint.Align.CENTER);c.drawText("10",12,16,p);break;case "muted":case "volume":line(c,3,9,7,9,12,4,12,20,7,15,3,15,3,9);if(name.equals("muted")){line(c,17,9,23,15);line(c,23,9,17,15);}else c.drawArc(8,4,23,20,-55,110,false,p);break;case "fullscreen":line(c,3,9,3,3,9,3);line(c,15,3,21,3,21,9);line(c,21,15,21,21,15,21);line(c,9,21,3,21,3,15);break;case "captions":c.drawRoundRect(2,5,22,19,2,2,p);p.setTextSize(9);p.setStyle(Paint.Style.FILL);p.setTextAlign(Paint.Align.CENTER);p.setTypeface(Typeface.DEFAULT_BOLD);c.drawText("CC",12,15,p);break;case "previous":case "next":if(name.equals("previous"))c.scale(-1,1,12,12);line(c,18,4,18,20);line(c,4,3,16,12,4,21,4,3);break;default:c.drawArc(3,3,21,21,145,250,false,p);line(c,12,13,17,6);c.drawCircle(12,13,1.5f,p);break;}c.restore();}
    }
}
