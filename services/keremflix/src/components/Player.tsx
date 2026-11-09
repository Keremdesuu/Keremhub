"use client";

import { AudioSubtitleMenu } from "./AudioSubtitleMenu";
import { useAudioSelection } from "./useAudioSelection";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { useVideoLayout } from "./useVideoLayout";
import { useSubtitlePreferences } from "./SubtitleSettings";
import { useVideoGestures } from "./useVideoGestures";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon, EpisodesIcon, Forward10Icon, FullscreenIcon, MuteIcon, NextIcon,
  PauseIcon, PlayIcon, Replay10Icon, SpeedIcon, SubtitlesIcon, VolumeIcon,
} from "./Icons";
import { withBase } from "@/lib/base";

interface Props {
  episodeId: number;
  titleId: number;
  title: string;
  subtitle: string;
  startAt: number;
  nextId: number | null;
  episodes: { id: number; label: string }[];
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function Ctl({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`grid h-10 w-10 shrink-0 sm:h-11 sm:w-11 place-items-center transition hover:scale-125 ${active ? "text-white" : "text-white/90"}`}>
      {children}
    </button>
  );
}

export function Player({ episodeId, titleId, title, subtitle, startAt, nextId, episodes }: Props) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const videoFrame=useVideoLayout(video,shell,episodeId);
  const [subtitlePreferences,setSubtitlePreferences]=useSubtitlePreferences();
  const fullscreenPending=useRef(false);
  const [playerNotice,setPlayerNotice]=useState<string|null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSave = useRef(0);
  const scrubbingRef = useRef(false);
  const [scrubbing,setScrubbing] = useState(false);
  const [captionCues,setCaptionCues]=useState<VTTCue[]>([]);
  const [subtitleStatus,setSubtitleStatus] = useState<string|null>(null);

  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioSelection=useAudioSelection(video,audio,episodeId,volume,muted);
  const [dismissed, setDismissed] = useState(false);
  const [ui, setUi] = useState(true);
  const [menu, setMenu] = useState<null | "speed" | "episodes" | "subtitles">(null);
  const [hasSubs, setHasSubs] = useState(false);
  const [subTracks,setSubTracks]=useState<{id:string;label:string;language:string;src:string;supported:boolean;external?:boolean;filename?:string}[]>([]);
  const [selectedSub,setSelectedSub]=useState<string|null>(null);
  const subsOn=selectedSub!==null;
  const selectedTrack=subTracks.find(t=>t.id===selectedSub);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);

  const save = useCallback((force = false) => {
    const v = video.current;
    if (!v || !isFinite(v.duration) || v.duration === 0) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 10_000) return;
    lastSave.current = now;
    const body = JSON.stringify({ episodeId, seconds: v.currentTime, duration: v.duration });
    if (force && navigator.sendBeacon) navigator.sendBeacon(withBase("/api/progress"), new Blob([body], { type: "application/json" }));
    else fetch(withBase("/api/progress"), { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [episodeId]);

  useEffect(()=>{
    const ctl=new AbortController();setSubTracks([]);setSelectedSub(null);
    fetch(withBase(`/api/subtitles/${episodeId}`),{signal:ctl.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
      if(ctl.signal.aborted)return;
      const files=(data.external??[]).map((t:{id:string;label:string;language:string;filename:string;version:string})=>({id:`external:${t.id}`,label:t.label,language:t.language,filename:t.filename,external:true,supported:true,src:withBase(`/api/subtitle/${episodeId}?file=${t.id}&v=${t.version}`)}));
      const embedded=data.streams.map((t:{index:number;label:string;language:string;supported:boolean})=>({id:String(t.index),label:t.label,language:t.language,supported:t.supported,src:withBase(`/api/subtitles/${episodeId}?stream=${t.index}`)}));
      setSubTracks([...files,...embedded]);setHasSubs(!data.error);
    }).catch(()=>{if(!ctl.signal.aborted){setSubTracks([]);setHasSubs(false);}});
    return ()=>ctl.abort();
  },[episodeId]);
  useEffect(()=>{
    const supported=subTracks.filter(t=>t.supported);
    const candidate=supported.find(t=>/^(tr|tur)$/.test(t.language))??supported[0];
    if(candidate)fetch(candidate.src).catch(()=>{});
  },[subTracks]);
  useEffect(()=>{
    const v=video.current,el=v?.querySelector("track");setCaptionCues([]);
    if(!v||!el){setSubtitleStatus(null);return;}
    const sync=()=>{
      const next=Array.from(el.track.activeCues??[]).filter((cue):cue is VTTCue=>cue instanceof VTTCue);
      setCaptionCues(previous=>previous.length===next.length&&previous.every((cue,i)=>cue===next[i])?previous:next);
    };
    const loaded=()=>{setSubtitleStatus(null);sync();};
    const failed=()=>{setCaptionCues([]);setSubtitleStatus("Altyazı yüklenemedi. Başka bir altyazı seçebilirsiniz.");};
    el.addEventListener("load",loaded);el.addEventListener("error",failed);
    el.track.addEventListener("cuechange",sync);v.addEventListener("timeupdate",sync);v.addEventListener("seeked",sync);
    setSubtitleStatus("Altyazı yükleniyor…");
    // Keep browser timing/parsing, but render over the entire player, including letterboxing.
    el.track.mode="hidden";
    if(el.readyState===2)loaded();if(el.readyState===3)failed();
    return ()=>{el.removeEventListener("load",loaded);el.removeEventListener("error",failed);el.track.removeEventListener("cuechange",sync);v.removeEventListener("timeupdate",sync);v.removeEventListener("seeked",sync);el.track.mode="disabled";};
  },[selectedTrack?.src]);

  useEffect(() => {
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); save(true); };
  }, [save]);

  const wake = useCallback(() => {
    setDismissed(false);
    setUi(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUi(false), 4000);
  }, []);
  useEffect(() => { wake(); return () => clearTimeout(hideTimer.current); }, [wake]);

  const toggle = useCallback(() => {
    const v = video.current; if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, []);
  const seek = useCallback((d: number) => { const v = video.current; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); }, []);
  const fullscreen = useCallback(async () => {
    if(fullscreenPending.current)return;
    fullscreenPending.current=true;setPlayerNotice(null);
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(shell.current?.requestFullscreen)await shell.current.requestFullscreen();
      else throw new Error("Fullscreen unavailable");
    }catch{setPlayerNotice("Tam ekran değiştirilemedi. Yeniden deneyin.");}
    finally{fullscreenPending.current=false;}
  }, []);
  const goNext = useCallback(() => { if (nextId) router.push(`/watch/${nextId}`); }, [nextId, router]);
  const toggleSubs=useCallback(()=>setMenu(m=>m==="subtitles"?null:"subtitles"),[]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,button,select,textarea,[contenteditable=true]")) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { e.preventDefault(); toggle(); }
      else if (k === "arrowleft" || k === "j") seek(-10);
      else if (k === "arrowright" || k === "l") seek(10);
      else if (k === "arrowup") { e.preventDefault(); setVolume((v) => Math.min(1, v + 0.1)); }
      else if (k === "arrowdown") { e.preventDefault(); setVolume((v) => Math.max(0, v - 0.1)); }
      else if (k === "m") setMuted((m) => !m);
      else if (k === "n") goNext();
      else if (k === "f") { e.preventDefault(); void fullscreen(); }
      else if (k === "c") toggleSubs();
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek, fullscreen, goNext, toggleSubs, wake]);

  useEffect(() => { const v = video.current; if (v) { v.volume = volume; v.muted = muted || audioSelection.external; } }, [volume, muted,audioSelection.external]);
  useEffect(() => { const v = video.current; if (v) v.playbackRate = speed; }, [speed]);

  function scrubAt(e: React.PointerEvent<HTMLInputElement>,commit=false) {
    const v=video.current;if(!v||!Number.isFinite(v.duration)||v.duration<=0)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const value=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*v.duration;
    setCur(value);
    if(commit)v.currentTime=value;
  }
  const visible = !dismissed && (ui || !playing || menu !== null || scrubbing);
  const hideControls = useCallback(() => { clearTimeout(hideTimer.current); setUi(false); setDismissed(true); setMenu(null); }, []);
  const gestures = useVideoGestures(video, wake, seek, episodeId, { visible, hide: hideControls });

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div ref={shell} onPointerMove={wake} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("[data-video-surface]")) gestures.cancelPendingTap(); wake(); }} onPointerUp={wake} onPointerCancel={wake} className={`keremflix-player z-[60] bg-black ${visible ? "" : "cursor-none"}`}>
      <video
        ref={video}
        src={withBase(`/api/stream/${episodeId}`)}
        autoPlay
        playsInline
        controls={false}
        className="keremflix-video pointer-events-none"
        style={videoFrame??{left:0,top:0,width:"100%",height:"100%"}}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); save(true); }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDur(v.duration);
          if (startAt > 5 && startAt < v.duration - 30) v.currentTime = startAt;
          
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if(!scrubbingRef.current)setCur(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          save();
        }}
        onEnded={() => { save(true); if (nextId) goNext(); }}
        onError={() => setError("Bu video tarayıcıda oynatılamadı. MP4 (H.264/AAC) en uyumlu formattır.")}
      >
        {selectedTrack&&<track key={selectedTrack.src} kind="subtitles" srcLang={selectedTrack.language} label={selectedTrack.label} src={selectedTrack.src} /> }
      </video>
      <audio ref={audio} preload="none" aria-hidden="true" className="hidden" />

      <div data-video-surface {...gestures.surface} className="absolute inset-0 touch-none" style={{ WebkitTouchCallout: "none" }} />
      {(subtitleStatus||playerNotice||audioSelection.status==="Ses hazırlanıyor…"||audioSelection.notice) && <div role="status" className="pointer-events-none absolute inset-x-0 top-24 text-center"><span className="rounded bg-black/80 px-4 py-2 text-white">{subtitleStatus||playerNotice||audioSelection.notice||audioSelection.status}</span></div>}
      {gestures.hint && <div className="pointer-events-none absolute inset-x-0 top-[22%] text-center"><span className="rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white">{gestures.hint}</span></div>}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-8 text-center">
          <p className="m-headline2 max-w-md">{error}</p>
        </div>
      )}

      {visible&&<><div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent"/><div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent"/></>}
      {selectedTrack&&<SubtitleOverlay cues={captionCues} preferences={subtitlePreferences} shell={shell} />}
      <div style={{ visibility: visible ? "visible" : "hidden" }} className={`pointer-events-none absolute inset-0 z-30 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
        {!menu && <button aria-label={playing ? "Ortadan duraklat" : "Ortadan oynat"} onClick={toggle} className="pointer-events-auto absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white ring-1 ring-white/25 sm:h-20 sm:w-20">{playing ? <PauseIcon size={36}/> : <PlayIcon size={36}/>}</button>}
        {/* Üst şerit */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-4 px-6 pb-10 pt-5">
          <Link href={`/title/${titleId}`} aria-label="Geri" title="Geri" className="pointer-events-auto grid h-10 w-10 shrink-0 sm:h-11 sm:w-11 place-items-center transition hover:scale-125"><ArrowLeftIcon size={32} /></Link>
          <div className="min-w-0">
            <p className="m-title3 truncate">{title}</p>
            {subtitle && <p className="r-smallbody text-gray-200">{subtitle}</p>}
          </div>
        </div>

        {/* Alt kontroller */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-5 pt-16">
          <div className="pointer-events-auto flex items-center gap-4">
            <div
              className="group relative h-6 flex-1 cursor-pointer py-2.5"
              onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: e.clientX - r.left, t: ((e.clientX - r.left) / r.width) * dur }); }}
              onMouseLeave={() => setHover(null)}

            >
              <div className="relative h-1 rounded bg-white/25 transition-all group-hover:h-1.5">
                <div className="absolute inset-y-0 left-0 rounded bg-white/35" style={{ width: `${dur ? (buffered / dur) * 100 : 0}%` }} />
                <div className="absolute inset-y-0 left-0 rounded bg-brand" style={{ width: `${pct}%` }} />
                <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand transition group-hover:scale-100 group-focus-within:scale-100" style={{ left: `${pct}%` }} />
              </div>
              <input type="range" aria-label="Oynatma konumu" aria-valuetext={`${fmt(cur)} / ${fmt(dur)}`} min={0} max={Number.isFinite(dur)&&dur>0?dur:0} step={0.1} value={Math.min(cur,dur||0)} disabled={!Number.isFinite(dur)||dur<=0}
                className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer touch-none opacity-0"
                onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);scrubbingRef.current=true;setScrubbing(true);scrubAt(e);wake();}}
                onPointerMove={e=>{if(scrubbingRef.current&&e.currentTarget.hasPointerCapture(e.pointerId))scrubAt(e);}}
                onPointerUp={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;scrubAt(e,true);scrubbingRef.current=false;setScrubbing(false);e.currentTarget.releasePointerCapture(e.pointerId);wake();save(true);}}
                onPointerCancel={()=>{scrubbingRef.current=false;setScrubbing(false);setCur(video.current?.currentTime??0);wake();}}
                onLostPointerCapture={()=>{scrubbingRef.current=false;setScrubbing(false);setCur(video.current?.currentTime??0);}}
                onChange={e=>{const value=Number(e.currentTarget.value);setCur(value);const v=video.current;if(v&&Number.isFinite(v.duration)&&v.duration>0)v.currentTime=Math.max(0,Math.min(v.duration,value));wake();}}
              />
              {hover && <span className="m-caption1 absolute -top-6 -translate-x-1/2 rounded bg-black/80 px-2 py-0.5" style={{ left: hover.x }}>{fmt(hover.t)}</span>}
            </div>
            <span className="m-smallbody w-28 flex-none text-right tabular-nums text-gray-100">{fmt(Math.max(0, dur - cur))}</span>
          </div>

          <div className="pointer-events-auto relative mt-1 flex flex-wrap items-center gap-0.5 sm:gap-1">
            <Ctl label={playing ? "Duraklat" : "Oynat"} onClick={toggle}>{playing ? <PauseIcon size={36} /> : <PlayIcon size={36} />}</Ctl>
            <Ctl label="10 sn geri" onClick={() => seek(-10)}><Replay10Icon size={34} /></Ctl>
            <Ctl label="10 sn ileri" onClick={() => seek(10)}><Forward10Icon size={34} /></Ctl>
            <div className="group/vol flex items-center">
              <Ctl label={muted || volume === 0 ? "Sesi aç" : "Sessize al"} onClick={() => setMuted((m) => !m)}>
                {muted || volume === 0 ? <MuteIcon size={32} /> : <VolumeIcon size={32} />}
              </Ctl>
              <input
                type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume} aria-label="Ses"
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="w-0 accent-brand opacity-0 transition-all duration-200 group-hover/vol:w-24 group-hover/vol:opacity-100"
              />
            </div>
            <span className="m-headline2 ml-4 hidden min-w-0 truncate lg:block">{title}{subtitle && <span className="r-body text-gray-300"> &nbsp;{subtitle}</span>}</span>

            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              {nextId && <Ctl label="Sonraki bölüm" onClick={goNext}><NextIcon size={32} /></Ctl>}
              {episodes.length > 1 && <Ctl label="Bölümler" onClick={() => setMenu((m) => (m === "episodes" ? null : "episodes"))}><EpisodesIcon size={32} /></Ctl>}
              <Ctl label="Ses ve altyazı" onClick={toggleSubs} active={subsOn}><SubtitlesIcon size={32} /></Ctl>
              <Ctl label="Oynatma hızı" onClick={() => setMenu((m) => (m === "speed" ? null : "speed"))}><SpeedIcon size={32} /></Ctl>
              <Ctl label="Tam ekran" onClick={fullscreen}><FullscreenIcon size={32} /></Ctl>
            </div>

            {menu === "subtitles" && <AudioSubtitleMenu audio={audioSelection} subtitles={subTracks} selectedSub={selectedSub} onSubtitle={id=>{setSelectedSub(id);setError(null);}} preferences={subtitlePreferences} onPreferences={setSubtitlePreferences} hasSubs={hasSubs} onClose={()=>setMenu(null)} />}
            {menu === "speed" && (
              <ul className="absolute bottom-14 right-14 w-40 overflow-hidden rounded-md bg-ink-700/95 py-1 backdrop-blur">
                {SPEEDS.map((s) => (
                  <li key={s}>
                    <button onClick={() => { setSpeed(s); setMenu(null); }} className={`r-body flex w-full items-center justify-between px-4 py-2 hover:bg-white/10 ${s === speed ? "m-body text-white" : "text-gray-200"}`}>
                      {s === 1 ? "Normal" : `${s}x`}{s === speed && <span className="text-brand">●</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {menu === "episodes" && (
              <ul className="absolute bottom-14 right-24 max-h-[50vh] w-80 overflow-y-auto rounded-md bg-ink-700/95 py-1 backdrop-blur">
                {episodes.map((ep) => (
                  <li key={ep.id}>
                    <Link href={`/watch/${ep.id}`} className={`r-smallbody block truncate px-4 py-2 hover:bg-white/10 ${ep.id === episodeId ? "m-smallbody text-white" : "text-gray-200"}`}>
                      {ep.id === episodeId && <span className="mr-2 text-brand">▶</span>}{ep.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
