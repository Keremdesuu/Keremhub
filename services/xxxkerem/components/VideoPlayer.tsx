"use client";

import { useVideoGestures } from "./useVideoGestures";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const SHORTCUTS: [string, string][] = [
  ["Boşluk / K", "Oynat / duraklat"],
  ["← / →", "5 sn geri / ileri"],
  ["J / L", "10 sn geri / ileri"],
  ["↑ / ↓", "Sesi aç / kıs"],
  ["M", "Sessiz"],
  ["Çift dokunma / tık", "Sol: −10 sn · Sağ: +10 sn"],
  ["Basılı tutma", "Geçici 2× hız"],
  ["P", "Küçük pencere (PiP)"],
  ["R", "Döngü"],
  ["< / >", "Hızı azalt / artır"],
  ["0 – 9", "Videonun %0–90'ına git"],
  ["Home / End", "Başa / sona git"],
  ["?", "Bu listeyi aç / kapat"],
];

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function load(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fs, setFs] = useState(false);
  const [pip, setPip] = useState(false);
  const [pipOk, setPipOk] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(true);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragRatio, setDragRatio] = useState(0);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 900);
  }, []);

  const poke = useCallback(() => {
    setDismissed(false);
    setActive(true);
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setActive(false), 2000);
  }, []);

  /* ---------- eylemler ---------- */
  const togglePlay = useCallback(() => {
    const v = vid.current;
    if (!v) return;
    if (v.ended) v.currentTime = 0;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback(
    (d: number) => {
      const v = vid.current;
      if (!v) return;
      v.currentTime = clamp(v.currentTime + d, 0, v.duration || 0);
      flash(`${d > 0 ? "+" : ""}${d} sn`);
    },
    [flash],
  );

  const seekToRatio = useCallback((r: number) => {
    const v = vid.current;
    if (!v || !v.duration) return;
    v.currentTime = clamp(r, 0, 1) * v.duration;
  }, []);

  const changeVolume = useCallback(
    (x: number, announce = true) => {
      const v = vid.current;
      if (!v) return;
      const n = clamp(x, 0, 1);
      v.volume = n;
      v.muted = n === 0;
      store("player:volume", String(n));
      store("player:muted", n === 0 ? "1" : "0");
      if (announce) flash(`Ses: ${Math.round(n * 100)}%`);
    },
    [flash],
  );

  const toggleMute = useCallback(() => {
    const v = vid.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
    store("player:muted", v.muted ? "1" : "0");
    flash(v.muted ? "Sessiz" : `Ses: ${Math.round(v.volume * 100)}%`);
  }, [flash]);

  const toggleFs = useCallback(() => {
    const b = box.current;
    const v = vid.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!b || !v) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (b.requestFullscreen) b.requestFullscreen().catch(() => {});
    else v.webkitEnterFullscreen?.();
  }, []);

  const togglePip = useCallback(() => {
    const v = vid.current;
    if (!v || !document.pictureInPictureEnabled) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture().catch(() => {});
  }, []);

  const applySpeed = useCallback(
    (r: number) => {
      const v = vid.current;
      if (!v) return;
      v.playbackRate = r;
      store("player:speed", String(r));
      flash(`Hız: ${r}x`);
    },
    [flash],
  );

  const toggleLoop = useCallback(() => {
    const v = vid.current;
    if (!v) return;
    v.loop = !v.loop;
    setLoop(v.loop);
    flash(v.loop ? "Döngü açık" : "Döngü kapalı");
  }, [flash]);

  /* ---------- başlangıç ayarları ---------- */
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    const vol = load("player:volume");
    if (vol !== null && !Number.isNaN(Number(vol))) v.volume = clamp(Number(vol), 0, 1);
    if (load("player:muted") === "1") v.muted = true;
    const sp = Number(load("player:speed"));
    if (SPEEDS.includes(sp)) v.playbackRate = sp;
    setVolume(v.volume);
    setMuted(v.muted);
    setSpeed(v.playbackRate);
    setPipOk(typeof document !== "undefined" && !!document.pictureInPictureEnabled);

    const onFs = () => setFs(document.fullscreenElement === box.current);
    const pipOn = () => setPip(true);
    const pipOff = () => setPip(false);
    document.addEventListener("fullscreenchange", onFs);
    v.addEventListener("enterpictureinpicture", pipOn);
    v.addEventListener("leavepictureinpicture", pipOff);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      v.removeEventListener("enterpictureinpicture", pipOn);
      v.removeEventListener("leavepictureinpicture", pipOff);
    };
  }, []);

  /* ---------- klavye kısayolları ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        if (!(t.tagName === "INPUT" && (t as HTMLInputElement).type === "range")) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const v = vid.current;
      if (!v) return;

      const k = e.key;
      let handled = true;
      if (k === " " || k === "k" || k === "K") togglePlay();
      else if (k === "ArrowLeft") seekBy(-5);
      else if (k === "ArrowRight") seekBy(5);
      else if (k === "j" || k === "J") seekBy(-10);
      else if (k === "l" || k === "L") seekBy(10);
      else if (k === "ArrowUp") changeVolume(v.volume + 0.05);
      else if (k === "ArrowDown") changeVolume(v.volume - 0.05);
      else if (k === "m" || k === "M") toggleMute();
      else if (k === "p" || k === "P") togglePip();
      else if (k === "r" || k === "R") toggleLoop();
      else if (k === "<" || k === ">") {
        const i = SPEEDS.indexOf(v.playbackRate);
        const next = clamp((i === -1 ? 2 : i) + (k === ">" ? 1 : -1), 0, SPEEDS.length - 1);
        applySpeed(SPEEDS[next]!);
      } else if (/^[0-9]$/.test(k)) seekToRatio(Number(k) / 10);
      else if (k === "Home") seekToRatio(0);
      else if (k === "End") seekToRatio(0.999);
      else if (k === "?") setHelp((h) => !h);
      else if (k === "Escape") {
        setHelp(false);
        setMenu(false);
        handled = false;
      } else handled = false;

      if (handled) {
        e.preventDefault();
        poke();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, seekToRatio, changeVolume, toggleMute, toggleFs, togglePip, toggleLoop, applySpeed, poke]);

  useEffect(() => () => {
    clearTimeout(hideT.current);
    clearTimeout(toastT.current);
  }, []);

  /* ---------- ilerleme çubuğu ---------- */
  const ratioFrom = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1);
  };

  const shownRatio = dragging ? dragRatio : duration ? time / duration : 0;
  const bufRatio = duration ? buffered / duration : 0;
  const visible = !dismissed && (active || !playing || menu || help || dragging);
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const hideControls = useCallback(() => { clearTimeout(hideT.current); setActive(false); setDismissed(true); setMenu(false); setHelp(false); }, []);
  const gestures = useVideoGestures(vid, poke, seekBy, src, { visible: !!visible, hide: hideControls });

  const iconBtn =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 hover:text-brand";

  return (
    <div
      ref={box}
      onPointerMove={poke}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("[data-video-surface]")) gestures.cancelPendingTap(); poke(); }}
      onPointerUp={poke}
      onPointerCancel={poke}
      className={`group/player relative aspect-video max-h-[78vh] w-full select-none overflow-hidden bg-black [&:fullscreen]:aspect-auto [&:fullscreen]:max-h-none ${
        visible ? "" : "cursor-none"
      }`}
    >
      <video
        ref={vid}
        src={src}
        poster={poster}
        autoPlay
        playsInline
        preload="metadata"
        controls={false}
        className="pointer-events-none h-full w-full bg-black object-contain"
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setEnded(true);
          setPlaying(false);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          for (let i = 0; i < v.buffered.length; i++) {
            if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) {
              setBuffered(v.buffered.end(i));
              break;
            }
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          for (let i = 0; i < v.buffered.length; i++) {
            if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) {
              setBuffered(v.buffered.end(i));
              break;
            }
          }
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
      />

      <div data-video-surface {...gestures.surface} className="absolute inset-0 touch-none" style={{ WebkitTouchCallout: "none" }} />
      {gestures.hint && <div className="pointer-events-none absolute inset-x-0 top-[18%] text-center"><span className="rounded-full bg-black/75 px-4 py-2 text-sm font-bold text-white">{gestures.hint}</span></div>}

      {/* tıklanabilir yükleniyor / durum katmanları */}
      {waiting && playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 size={52} className="animate-spin text-brand" />
        </div>
      )}

      {visible && !menu && !help && (
        <button
          aria-label={playing ? "Ortadan duraklat" : "Ortadan oynat"}
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 sm:h-20 sm:w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-ink shadow-xl transition-transform hover:scale-110"
        >
          {playing ? <Pause size={34} fill="currentColor" /> : ended ? <RotateCcw size={34} /> : <Play size={36} fill="currentColor" className="ml-1" />}
        </button>
      )}

      {toast && !gestures.hint && (
        <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-sm font-bold text-white ring-1 ring-brand/60">
          {toast}
        </div>
      )}

      {help && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHelp(false)}
        >
          <div
            className="max-h-full w-full max-w-md overflow-y-auto rounded-xl bg-panel p-5 ring-1 ring-[#3a3a3a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-brand">
                <Keyboard size={16} /> Klavye kısayolları
              </h3>
              <button onClick={() => setHelp(false)} aria-label="Kapat" className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {SHORTCUTS.map(([key, desc]) => (
                <li key={key} className="flex items-center justify-between gap-4">
                  <span className="text-muted">{desc}</span>
                  <kbd className="rounded bg-ink px-2 py-0.5 text-xs font-bold text-white ring-1 ring-[#3a3a3a]">{key}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* kontrol çubuğu */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
        }}
        style={{ visibility: visible ? "visible" : "hidden" }}
        className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-200 ${
          visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* ilerleme */}
        <div
          ref={track}
          role="slider"
          aria-label="Video ilerlemesi"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          className="pointer-events-auto group/bar relative flex h-5 cursor-pointer touch-none items-center"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = ratioFrom(e.clientX);
            setDragging(true);
            setDragRatio(r);
            seekToRatio(r);
          }}
          onPointerMove={(e) => {
            const r = ratioFrom(e.clientX);
            setHover(r);
            if (dragging) {
              setDragRatio(r);
              seekToRatio(r);
            }
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onPointerLeave={() => setHover(null)}
        >
          <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${bufRatio * 100}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${shownRatio * 100}%` }} />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-brand shadow transition-transform group-hover/bar:scale-100"
              style={{ left: `${shownRatio * 100}%`, transform: dragging ? "translate(-50%, -50%) scale(1)" : undefined }}
            />
          </div>
          {hover !== null && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/85 px-2 py-0.5 text-xs font-bold text-white"
              style={{ left: `${hover * 100}%` }}
            >
              {fmt(hover * duration)}
            </div>
          )}
        </div>

        <div className="pointer-events-auto mt-0.5 flex flex-wrap items-center gap-0.5 sm:gap-1">
          <button tabIndex={-1} onClick={togglePlay} className={iconBtn} aria-label={playing ? "Duraklat" : "Oynat"} title="Oynat / duraklat (K)">
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button tabIndex={-1} onClick={() => seekBy(-10)} className={`${iconBtn} hidden sm:flex`} aria-label="10 saniye geri" title="10 sn geri (J)">
            <RotateCcw size={20} />
          </button>
          <button tabIndex={-1} onClick={() => seekBy(10)} className={`${iconBtn} hidden sm:flex`} aria-label="10 saniye ileri" title="10 sn ileri (L)">
            <RotateCw size={20} />
          </button>

          <div className="group/vol flex items-center">
            <button tabIndex={-1} onClick={toggleMute} className={iconBtn} aria-label="Sessiz" title="Sessiz (M)">
              <VolIcon size={21} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value), false)}
              aria-label="Ses"
              tabIndex={-1}
              style={{
                background: `linear-gradient(to right, #ffa31a ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(muted ? 0 : volume) * 100}%)`,
              }}
              className="vol-range hidden sm:block h-1 w-0 cursor-pointer transition-all duration-200 group-hover/vol:ml-1 group-hover/vol:mr-2 group-hover/vol:w-24 focus:ml-1 focus:mr-2 focus:w-24"
            />
          </div>

          <span className="ml-1 whitespace-nowrap text-xs font-semibold tabular-nums text-white sm:text-sm">
            {fmt(dragging ? dragRatio * duration : time)} <span className="hidden text-muted sm:inline">/ {fmt(duration)}</span>
          </span>

          <div className="flex-1" />

          <div className="relative">
            <button
              tabIndex={-1}
              onClick={() => setMenu((m) => !m)}
              className={`${iconBtn} w-auto px-2.5 text-sm font-extrabold ${menu ? "text-brand" : ""}`}
              aria-label="Oynatma hızı"
              title="Oynatma hızı (< >)"
            >
              {speed}x
            </button>
            {menu && (
              <div className="absolute bottom-full right-0 mb-2 w-32 rounded-lg bg-panel p-1 shadow-xl ring-1 ring-[#3a3a3a]">
                <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">Hız</p>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    tabIndex={-1}
                    onClick={() => {
                      applySpeed(s);
                      setMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-sm font-semibold hover:bg-ink ${
                      s === speed ? "text-brand" : "text-white"
                    }`}
                  >
                    {s === 1 ? "Normal" : `${s}x`}
                    {s === speed && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            tabIndex={-1}
            onClick={toggleLoop}
            className={`${iconBtn} hidden sm:flex ${loop ? "text-brand" : ""}`}
            aria-label="Döngü"
            aria-pressed={loop}
            title="Döngü (R)"
          >
            <Repeat size={19} />
          </button>
          <button tabIndex={-1} onClick={() => setHelp(true)} className={`${iconBtn} hidden sm:flex`} aria-label="Klavye kısayolları" title="Kısayollar (?)">
            <Keyboard size={20} />
          </button>
          {pipOk && (
            <button
              tabIndex={-1}
              onClick={togglePip}
              className={`${iconBtn} hidden sm:flex ${pip ? "text-brand" : ""}`}
              aria-label="Küçük pencere"
              title="Küçük pencere (P)"
            >
              <PictureInPicture2 size={20} />
            </button>
          )}
          <button tabIndex={-1} onClick={toggleFs} className={iconBtn} aria-label="Tam ekran" title="Tam ekran">
            {fs ? <Minimize size={21} /> : <Maximize size={21} />}
          </button>
        </div>
      </div>
    </div>
  );
}
