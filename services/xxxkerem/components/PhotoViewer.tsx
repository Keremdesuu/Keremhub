"use client";

import { useRouter } from "next/navigation";
import { BASE } from "@/lib/url";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

const MAX_SCALE = 8;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

type View = { s: number; x: number; y: number; rotation: number };

export default function PhotoViewer({
  src,
  mediaId,
  previewSrc,
  adjacentPreviews,
  alt,
  prevHref,
  nextHref,
}: {
  src: string;
  mediaId: number;
  previewSrc: string;
  adjacentPreviews: string[];
  alt: string;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [displaySrc, setDisplaySrc] = useState(previewSrc);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const rotating = useRef(false);
  const currentSrc = useRef(src);
  useEffect(() => { currentSrc.current = src; setDisplaySrc(previewSrc); setStatus(""); }, [src, previewSrc]);
  const box = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const viewRef = useRef<View>({ s: 1, x: 0, y: 0, rotation: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const [view, setViewState] = useState<View>({ s: 1, x: 0, y: 0, rotation: 0 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [panning, setPanning] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    if (view.s > 1.4 || fs) setDisplaySrc(src);
  }, [view.s, fs, src]);
  const adjacentKey = adjacentPreviews.join("|");
  useEffect(() => {
    const images = adjacentKey ? adjacentKey.split("|").map(url => { const img = new Image(); img.src = url; return img; }) : [];
    return () => { images.forEach(img => { img.src = ""; }); };
  }, [adjacentKey]);

  const setView = useCallback((fn: (v: View) => View) => {
    const next = fn(viewRef.current);
    viewRef.current = next;
    setViewState(next);
  }, []);

  const reset = useCallback(() => setView(() => ({ s: 1, x: 0, y: 0, rotation: 0 })), [setView]);

  const rotate = useCallback(async () => {
    if (rotating.current) return;
    rotating.current = true; setSaving(true); setStatus("Orijinal dosyaya kaydediliyor…");
    const requestedSrc = src;
    try {
      const res = await fetch(`${BASE}/api/media/${mediaId}/rotate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fotoğraf kaydedilemedi");
      if (currentSrc.current === requestedSrc) {
        pointers.current.clear(); pinch.current = null; pan.current = null; setPanning(false);
        reset(); setDisplaySrc(`${previewSrc.split("?")[0]}?v=${data.version}`);
        setImageSize({w:data.width,h:data.height}); setStatus("Orijinal dosya kaydedildi");
        router.refresh();
      }
    } catch (e) {
      if (currentSrc.current === requestedSrc) setStatus(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally { rotating.current = false; setSaving(false); }
  }, [src, previewSrc, mediaId, reset, router]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const img = image.current;
    if (img?.complete && img.naturalWidth) setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
  }, [displaySrc]);
  const baseFit = imageSize.w && imageSize.h ? Math.min(boxSize.w / imageSize.w, boxSize.h / imageSize.h) : 0;
  const rotationFit = view.rotation % 180 && baseFit > 0
    ? Math.min(boxSize.w / (imageSize.h * baseFit), boxSize.h / (imageSize.w * baseFit)) : 1;

  // Başka fotoğrafa geçince zoom sıfırlanır (tam ekran bozulmaz, bileşen aynı kalır)
  useEffect(() => {
    reset();
  }, [src, reset]);

  /** (cx, cy) ekran noktasına doğru yakınlaştır; fn mevcut ölçekten yeni ölçeği üretir */
  const zoomAt = useCallback(
    (cx: number | null, cy: number | null, fn: (s: number) => number) => {
      const el = box.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (cx ?? r.left + r.width / 2) - (r.left + r.width / 2);
      const py = (cy ?? r.top + r.height / 2) - (r.top + r.height / 2);
      setView((v) => {
        const ns = clamp(fn(v.s), 1, MAX_SCALE);
        if (ns <= 1.001) return { ...v, s: 1, x: 0, y: 0 };
        const k = ns / v.s;
        return { ...v, s: ns, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
      });
    },
    [setView],
  );

  const toggleFs = useCallback(() => {
    const root = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else {
      root.dataset.photoFullscreen = "true";
      root.requestFullscreen?.().catch(() => { delete root.dataset.photoFullscreen; });
    }
  }, []);

  useEffect(() => {
    const onFs = () => {
      const root = document.documentElement;
      const active = document.fullscreenElement === root && root.dataset.photoFullscreen === "true";
      setFs(active);
      if (!document.fullscreenElement) delete root.dataset.photoFullscreen;
    };
    onFs();
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Fare tekerleği ile zoom (sayfa kaydırmasını engellemek için passive olmayan dinleyici)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, (s) => s * Math.exp(-e.deltaY * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Klavye: + - 0 F
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") zoomAt(null, null, (s) => s * 1.4);
      else if (e.key === "-" || e.key === "_") zoomAt(null, null, (s) => s / 1.4);
      else if (e.key === "0") reset();
      else if (e.key === "r" || e.key === "R") rotate();
      else if (e.key === "f" || e.key === "F") toggleFs();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt, reset, rotate, toggleFs]);

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a!.x - b!.x, a!.y - b!.y);
  };

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 hover:text-brand";
  const navBtn =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-brand hover:text-ink";

  return (
    <div
      ref={box}
      className="photo-viewer relative h-[78vh] w-full touch-none select-none overflow-hidden rounded-lg bg-black ring-1 ring-panel [&:fullscreen]:h-screen [&:fullscreen]:rounded-none [&:fullscreen]:ring-0"
      style={{ cursor: view.s > 1 ? (panning ? "grabbing" : "grab") : "zoom-in" }}
      onDoubleClick={(e) => {
        if (viewRef.current.s > 1) reset();
        else zoomAt(e.clientX, e.clientY, () => 2.5);
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          pinch.current = { d: dist(), s: viewRef.current.s };
          pan.current = null;
        } else if (viewRef.current.s > 1) {
          pan.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
          setPanning(true);
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current) {
          const [a, b] = [...pointers.current.values()];
          const target = pinch.current.s * (dist() / pinch.current.d);
          zoomAt((a!.x + b!.x) / 2, (a!.y + b!.y) / 2, () => target);
        } else if (pan.current) {
          const p = pan.current;
          setView((v) => ({ ...v, x: p.vx + (e.clientX - p.x), y: p.vy + (e.clientY - p.y) }));
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
        pan.current = null;
        setPanning(false);
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
        pan.current = null;
        setPanning(false);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        src={displaySrc}
        alt={alt}
        decoding="async"
        fetchPriority="high"
        draggable={false}
        onLoad={e => setImageSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="h-full w-full object-contain"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.s * rotationFit}) rotate(${view.rotation}deg)`,
          transition: panning ? "none" : "transform 90ms ease-out",
        }}
      />

      {status && <p role="status" className="absolute left-3 top-3 z-20 max-w-[90%] rounded bg-black/80 px-3 py-2 text-sm text-white">{status}</p>}

      {prevHref && (
        <Link href={prevHref} className={`${navBtn} left-3`} aria-label="Önceki fotoğraf" title="Önceki (←)">
          <ChevronLeft size={26} />
        </Link>
      )}
      {nextHref && (
        <Link href={nextHref} className={`${navBtn} right-3`} aria-label="Sonraki fotoğraf" title="Sonraki (→)">
          <ChevronRight size={26} />
        </Link>
      )}

      <div
        className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/70 px-2 py-1 ring-1 ring-white/10 backdrop-blur"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button className={iconBtn} onClick={() => zoomAt(null, null, (s) => s / 1.4)} aria-label="Uzaklaştır" title="Uzaklaştır (-)">
          <ZoomOut size={19} />
        </button>
        <button
          onClick={reset}
          className="min-w-14 rounded px-1 text-center text-xs font-extrabold tabular-nums text-white hover:text-brand"
          title="Sıfırla (0)"
        >
          {Math.round(view.s * 100)}%
        </button>
        <button className={iconBtn} onClick={() => zoomAt(null, null, (s) => s * 1.4)} aria-label="Yakınlaştır" title="Yakınlaştır (+)">
          <ZoomIn size={19} />
        </button>
        <button className={iconBtn} onClick={rotate} disabled={saving} aria-label="Sağa döndür ve kaydet" title="90° sağa döndür ve orijinal dosyaya kaydet (R)">
          <RotateCw size={18} />
        </button>
        <span className="mx-1 h-5 w-px bg-white/20" />
        <button className={iconBtn} onClick={toggleFs} aria-label="Tam ekran" title="Tam ekran (F)">
          {fs ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
      </div>
    </div>
  );
}
