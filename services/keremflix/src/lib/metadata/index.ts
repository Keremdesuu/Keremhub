import { config } from "../config";
import { anilistAnime } from "./anilist";
import { tmdbMovie, tmdbTv } from "./tmdb";
import { tvmazeShow } from "./tvmaze";
import type { Meta } from "./types";

export type Kind = "SERIES" | "MOVIE" | "ANIME";
export type { Meta };

/** Türe göre uygun kaynaklardan metadata çeker. `null` = bulunamadı. */
export async function fetchMetadata(kind: Kind, title: string, year: number | null): Promise<{ meta: Meta | null; status: string }> {
  const hasKey = Boolean(config.tmdbKey);
  let meta: Meta | null = null;
  let unavailable=false;
  async function attempt(fn:()=>Promise<Meta|null>){try{return await fn();}catch{unavailable=true;return null;}}

  if (kind === "ANIME") {
    meta = await attempt(()=>anilistAnime(title));
    if (!meta && hasKey) meta = await attempt(()=>tmdbTv(title, year));
  } else if (kind === "SERIES") {
    meta = hasKey ? await attempt(()=>tmdbTv(title, year)) : null;
    if (!meta) meta = await attempt(()=>tvmazeShow(title));
  } else {
    if (!hasKey) return { meta: null, status: "no-key" };
    meta = await attempt(()=>tmdbMovie(title, year));
  }
  return { meta, status: meta ? "ok" : unavailable ? "unavailable" : "not-found" };
}
