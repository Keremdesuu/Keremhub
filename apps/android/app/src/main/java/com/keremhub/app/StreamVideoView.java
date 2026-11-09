package com.keremhub.app;

import android.content.Context;
import android.graphics.SurfaceTexture;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.view.*;

/** Native player with a retained texture and a small, bounded HTTP range cache. */
final class StreamVideoView extends TextureView implements TextureView.SurfaceTextureListener {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AudioManager audio;
    private final AudioFocusRequest focus;
    private MediaPlayer player;
    private SurfaceTexture texture;
    private Surface surface;
    private boolean opening;
    private volatile RangeMediaSource source;
    private volatile int generation;
    private boolean prepared, playWhenReady, hasFocus, resumeAfterFocus;
    private int width, height;
    private MediaPlayer.OnPreparedListener onPrepared;
    private MediaPlayer.OnInfoListener onInfo;
    private MediaPlayer.OnCompletionListener onCompletion;
    private MediaPlayer.OnErrorListener onError;

    StreamVideoView(Context context) {
        super(context);
        audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                .setOnAudioFocusChangeListener(change->{
                    if(change==AudioManager.AUDIOFOCUS_GAIN){hasFocus=true;if(resumeAfterFocus&&playWhenReady&&prepared)player.start();resumeAfterFocus=false;}
                    else {resumeAfterFocus=playWhenReady;hasFocus=false;if(prepared&&player.isPlaying())player.pause();if(change==AudioManager.AUDIOFOCUS_LOSS){playWhenReady=false;resumeAfterFocus=false;}}
                },main).build();
        setSurfaceTextureListener(this);
    }
    void setOnPreparedListener(MediaPlayer.OnPreparedListener l) { onPrepared = l; }
    void setOnInfoListener(MediaPlayer.OnInfoListener l) { onInfo = l; }
    void setOnCompletionListener(MediaPlayer.OnCompletionListener l) { onCompletion = l; }
    void setOnErrorListener(MediaPlayer.OnErrorListener l) { onError = l; }

    void setVideoURI(Uri uri) {
        stopPlayback();
        opening=true;
        int token = generation;
        // Do not queue playback behind artwork or subtitle extraction.
        Thread worker = new Thread(() -> {
            RangeMediaSource opened = null;
            try {
                opened = new RangeMediaSource(uri.toString());
                if (token != generation) { opened.close(); return; }
                RangeMediaSource loaded = opened;
                main.post(() -> { if (token == generation) { opening=false;source=loaded; prepare(); } else loaded.close(); });
            } catch (Exception error) {
                if (opened != null) opened.close();
                android.util.Log.w("KeremhubPlayer", "Range stream failed", error);
                main.post(() -> { if (token == generation) {opening=false;if(onError != null)onError.onError(null, MediaPlayer.MEDIA_ERROR_IO, 0);} });
            }
        }, "Keremhub-stream");
        worker.setDaemon(true);
        worker.start();
    }
    private void prepare() {
        if (source == null || player != null || !isAvailable() || surface == null || !surface.isValid()) return;
        MediaPlayer mp = new MediaPlayer();
        player = mp;
        try {
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build());
            mp.setSurface(surface);
            mp.setDataSource(source);
            mp.setOnVideoSizeChangedListener((m,w,h) -> { width=w; height=h; requestLayout(); });
            mp.setOnPreparedListener(m -> { if (player != m) return; prepared=true; if (onPrepared != null) onPrepared.onPrepared(m); });
            mp.setOnInfoListener((m,w,e) -> onInfo != null && onInfo.onInfo(m,w,e));
            mp.setOnCompletionListener(m -> { playWhenReady=false; if (onCompletion != null) onCompletion.onCompletion(m); });
            mp.setOnErrorListener((m,w,e) -> { prepared=false; return onError != null && onError.onError(m,w,e); });
            mp.prepareAsync();
        } catch (Exception error) { if (onError != null) onError.onError(mp,MediaPlayer.MEDIA_ERROR_IO,0); }
    }
    void start() { playWhenReady=true; if(!hasFocus)hasFocus=audio.requestAudioFocus(focus)==AudioManager.AUDIOFOCUS_REQUEST_GRANTED; if (prepared&&hasFocus) player.start(); }
    void pause() { playWhenReady=false; if (prepared && player.isPlaying()) player.pause(); }
    boolean isPlaying() { return prepared && player != null && player.isPlaying(); }
    int getDuration() { return prepared ? player.getDuration() : 0; }
    int getCurrentPosition() { return prepared ? player.getCurrentPosition() : 0; }
    void seekTo(int ms) { if (prepared && ms >= 0) player.seekTo(ms,MediaPlayer.SEEK_CLOSEST_SYNC); }
    void stopPlayback() {
        generation++;
        opening=false;
        prepared=false; playWhenReady=false;
        resumeAfterFocus=false;hasFocus=false;audio.abandonAudioFocusRequest(focus);
        RangeMediaSource old=source; source=null;
        if (old != null) old.close();
        if (player != null) { player.release(); player=null; }
        if(!isAvailable())releaseTexture();
    }
    private void releaseTexture(){
        if(surface!=null){surface.release();surface=null;}
        if(texture!=null){texture.release();texture=null;}
    }
    public void onSurfaceTextureAvailable(SurfaceTexture available,int w,int h){
        if(texture==null){texture=available;surface=new Surface(texture);}
        else if(texture!=available)setSurfaceTexture(texture);
        // The decoder keeps the same Surface/BufferQueue while the View moves
        // between inline, fullscreen and PiP windows. No re-prepare or seek.
        prepare();
    }
    public void onSurfaceTextureSizeChanged(SurfaceTexture texture,int w,int h){}
    public void onSurfaceTextureUpdated(SurfaceTexture texture){}
    public boolean onSurfaceTextureDestroyed(SurfaceTexture destroyed){
        if(player!=null||source!=null||opening)return false;
        if(surface!=null){surface.release();surface=null;}
        texture=null;return true;
    }
    @Override protected void onMeasure(int widthSpec,int heightSpec) {
        int w=MeasureSpec.getSize(widthSpec),h=MeasureSpec.getSize(heightSpec);
        if (width>0 && height>0) { if ((long)w*height>(long)h*width) w=(int)((long)h*width/height); else h=(int)((long)w*height/width); }
        setMeasuredDimension(w,h);
    }
}
