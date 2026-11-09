import { api, preferences } from "./api.ts";
import type { Detail, Episode } from "./types.ts";
type Saved = {
  episodeId: number;
  seconds: number;
  duration: number;
  updatedAt: number;
  pending: boolean;
};
const writes = new Map<number, Promise<unknown>>();
const key = (id: number) =>
  "keremflix.progress." + preferences().server + ":" + id;
export function savedProgress(id: number): Saved | null {
  try {
    const p = JSON.parse(localStorage.getItem(key(id)) || "null");
    return p &&
      Number.isFinite(p.seconds) &&
      Number.isFinite(p.duration) &&
      p.seconds >= 0 &&
      p.duration > 0
      ? p
      : null;
  } catch {
    return null;
  }
}
export function saveProgress(
  episode: Episode,
  seconds: number,
  duration: number,
) {
  const old = savedProgress(episode.id);
  const value: Saved = {
    episodeId: episode.id,
    seconds,
    duration,
    updatedAt: Math.max(Date.now(), (old?.updatedAt || 0) + 1),
    pending: true,
  };
  try {
    localStorage.setItem(key(episode.id), JSON.stringify(value));
  } catch {}
  const next = (writes.get(episode.id) || Promise.resolve())
    .catch(() => {})
    .then(() =>
      api("/api/progress", { episodeId: episode.id, seconds, duration }),
    )
    .then(() => {
      if (savedProgress(episode.id)?.updatedAt === value.updatedAt)
        try {
          localStorage.setItem(
            key(episode.id),
            JSON.stringify({ ...value, pending: false }),
          );
        } catch {}
    })
    .catch(() => {});
  writes.set(episode.id, next);
}
export function mergeProgress(detail: Detail): Detail {
  let latest: Saved | null = null;
  const episodes = detail.episodes.map((ep) => {
    const saved = savedProgress(ep.id);
    if (!saved || (!saved.pending && Date.now() - saved.updatedAt > 120000))
      return ep;
    if (!latest || saved.updatedAt > latest.updatedAt) latest = saved;
    return { ...ep, seconds: saved.seconds, duration: saved.duration };
  });
  const last = latest as Saved | null;
  return {
    ...detail,
    episodes,
    title: {
      ...detail.title,
      resumeEpisodeId: last ? last.episodeId : detail.title.resumeEpisodeId,
    },
  };
}
