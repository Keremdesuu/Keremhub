"use client";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
type Playback = Pick<HTMLVideoElement, "paused" | "ended" | "playbackRate">;
type Point = { id: number; x: number; y: number; right: boolean };
type Clock = { now: () => number; later: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
/** Surface gestures never act on playback buttons. */
export function createVideoGestures(options: {
  video: () => Playback | null; wake: () => void; seek: (seconds: number) => void; hold: (active: boolean) => void; visible?: () => boolean; tap?: (wasVisible: boolean) => void;
}, clock: Clock = { now: Date.now, later: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) }) {
  let press: (Point & { at: number; moved: boolean; held: boolean; shown: boolean }) | null = null;
  let last: (Point & { at: number }) | null = null;
  let timer: unknown;
  let singleTimer: unknown;
  let boosted: { video: Playback; rate: number } | null = null;
  function stopHold() { clock.clear(timer); if (boosted) { boosted.video.playbackRate = boosted.rate; boosted = null; options.hold(false); } }
  function cancel() { if (!press) return; clock.clear(singleTimer); stopHold(); press = null; last = null; }
  return {
    down(point: Point) {
      if (press) { cancel(); return; }
      clock.clear(singleTimer);
      const shown = options.visible?.() ?? true;
      options.wake(); press = { ...point, at: clock.now(), moved: false, held: false, shown };
      timer = clock.later(() => {
        const v = options.video();
        if (!press || press.moved || !v || v.paused || v.ended) return;
        press.held = true; last = null; boosted = { video: v, rate: v.playbackRate };
        v.playbackRate = 2; options.hold(true);
      }, 450);
    },
    move(point: Point) {
      if (!press || press.id !== point.id) return;
      if (Math.hypot(point.x - press.x, point.y - press.y) > 14) { press.moved = true; stopHold(); last = null; }
    },
    up(point: Point) {
      if (!press || press.id !== point.id) return;
      const old = press; const at = clock.now(); stopHold(); press = null; options.wake();
      if (old.held || old.moved || at - old.at >= 450) { last = null; return; }
      if (last && at - last.at <= 320 && last.right === point.right && Math.hypot(point.x - last.x, point.y - last.y) < 80) {
        options.seek(point.right ? 10 : -10); last = null;
      } else { last = { ...point, at }; singleTimer = clock.later(() => { last = null; options.tap?.(old.shown); }, 320); }
    },
    cancel,
    reset() { cancel(); stopHold(); clock.clear(singleTimer); last = null; },
  };
}
export function useVideoGestures(video: RefObject<HTMLVideoElement | null>, wake: () => void, seek: (seconds: number) => void, mediaKey: string | number, visibility: { visible: boolean; hide: () => void }) {
  const callbacks = useRef({ wake, seek, visibility }); callbacks.current = { wake, seek, visibility };
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const engine = useMemo(() => createVideoGestures({
    video: () => video.current,
    wake: () => callbacks.current.wake(),
    seek: n => { callbacks.current.seek(n); setFeedback(n > 0 ? "10 sn ileri" : "10 sn geri"); clearTimeout(feedbackTimer.current); feedbackTimer.current = setTimeout(() => setFeedback(null), 800); },
    hold: setHolding,
    visible: () => callbacks.current.visibility.visible,
    tap: shown => { if (shown) callbacks.current.visibility.hide(); else callbacks.current.wake(); },
  }), [video]);
  useEffect(() => {
    const reset = () => engine.reset();
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener("blur", reset); window.addEventListener("pagehide", reset); document.addEventListener("visibilitychange", visibility);
    return () => { engine.reset(); clearTimeout(feedbackTimer.current); window.removeEventListener("blur", reset); window.removeEventListener("pagehide", reset); document.removeEventListener("visibilitychange", visibility); };
  }, [engine, mediaKey]);
  function point(e: ReactPointerEvent<HTMLDivElement>) { const r = e.currentTarget.getBoundingClientRect(); return { id: e.pointerId, x: e.clientX, y: e.clientY, right: e.clientX >= r.left + r.width / 2 }; }
  return {
    cancelPendingTap: () => engine.reset(),
    hint: holding ? "2× hız" : feedback,
    surface: {
      onPointerDown(e: ReactPointerEvent<HTMLDivElement>) { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); engine.down(point(e)); },
      onPointerMove(e: ReactPointerEvent<HTMLDivElement>) { engine.move(point(e)); },
      onPointerUp(e: ReactPointerEvent<HTMLDivElement>) { engine.up(point(e)); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); },
      onPointerCancel: () => engine.cancel(),
      onLostPointerCapture: () => engine.cancel(),
      onDoubleClick(e: React.MouseEvent<HTMLDivElement>) { e.preventDefault(); },
      onContextMenu(e: React.MouseEvent<HTMLDivElement>) { e.preventDefault(); },
    },
  };
}
