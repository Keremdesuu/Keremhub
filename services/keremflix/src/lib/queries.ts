import { cache } from "react";
import {newContentWindow,NEW_CONTENT_LIMIT,chooseHero} from "./discovery";
import { prisma } from "./db";
import type { Kind } from "@/lib/kinds";

export interface TitleDTO {
  id: number;
  kind: Kind;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  cast: string[];
  moods: string[];
  rating: number | null;
  certification: string | null;
  runtime: number | null;
  seasons: number;
  episodeCount: number;
  quality: string | null;
  isNew: boolean;
  inList: boolean;
  progress: number | null; // 0-1, "İzlemeye devam et" satırı için
  resumeEpisodeId: number | null;
  firstEpisodeId: number | null;
}

const newTitleIds=cache(async()=>new Set((await prisma.title.findMany({where:{addedAt:newContentWindow(),episodes:{some:{}}},select:{id:true},orderBy:[{addedAt:"desc"},{id:"desc"}],take:NEW_CONTENT_LIMIT})).map(row=>row.id)));
const parse = (s: string): string[] => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
};

const include = {
  episodes: { select: { id: true, season: true, number: true, quality: true }, orderBy: [{ season: "asc" as const }, { number: "asc" as const }] },
};

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(where: object = {}, take?: number, orderBy: object = { addedAt: "desc" }) {
  return prisma.title.findMany({ where, include, orderBy, take });
}

async function listIds() {
  const rows: { titleId: number }[] = await prisma.listItem.findMany({ select: { titleId: true } });
  return new Set<number>(rows.map((l) => l.titleId));
}

function bestQuality(qs: (string | null)[]): string | null {
  if (qs.some((q) => q?.startsWith("4K"))) return qs.find((q) => q?.startsWith("4K")) ?? "4K";
  if (qs.some((q) => q === "HD")) return "HD";
  return qs.find(Boolean) ?? null;
}

function toDTO(r: Row, list: Set<number>,newIds:Set<number>): TitleDTO {
  const seasons = new Set(r.episodes.map((e) => e.season)).size;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    year: r.year,
    overview: r.overview,
    posterUrl: r.posterUrl,
    backdropUrl: r.backdropUrl,
    genres: parse(r.genres),
    cast: parse(r.cast),
    moods: parse(r.moods),
    rating: r.rating,
    certification: r.certification,
    runtime: r.runtime,
    seasons,
    episodeCount: r.episodes.length,
    quality: bestQuality(r.episodes.map((e) => e.quality)),
    isNew: newIds.has(r.id),
    inList: list.has(r.id),
    progress: null,
    resumeEpisodeId: null,
    firstEpisodeId: r.episodes[0]?.id ?? null,
  };
}

async function many(where: object = {}, take?: number, orderBy?: object) {
  const [rows, list,newIds] = await Promise.all([loadRows(where, take, orderBy), listIds(),newTitleIds()]);
  return rows.map((r) => toDTO(r, list,newIds));
}

export {KIND_LABEL} from "./kinds";
export const KIND_ROUTE: Record<Kind, string> = { SERIES: "/dizi", MOVIE: "/film", ANIME: "/anime" };

export async function continueWatching(kind?: Kind): Promise<TitleDTO[]> {
  const prog = await prisma.progress.findMany({
    where: { seconds: { gt: 20 }, ...(kind ? { episode: { title: { kind } } } : {}) },
    include: { episode: true },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });
  const seen = new Set<number>();
  const picks = prog.filter((p) => {
    if (p.duration > 0 && p.seconds / p.duration > 0.95) return false; // bitirilmiş
    if (seen.has(p.episode.titleId)) return false;
    seen.add(p.episode.titleId);
    return true;
  }).slice(0, 12);
  if (!picks.length) return [];
  const [list,newIds] = await Promise.all([listIds(),newTitleIds()]);
  const rows = await prisma.title.findMany({ where: { id: { in: picks.map((p) => p.episode.titleId) } }, include });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return picks.flatMap((p) => {
    const r = byId.get(p.episode.titleId);
    if (!r) return [];
    const dto = toDTO(r, list,newIds);
    dto.progress = p.duration > 0 ? Math.min(1, p.seconds / p.duration) : 0;
    dto.resumeEpisodeId = p.episodeId;
    return [dto];
  });
}

export async function recent(kind?: Kind, take = 20) {
  return many(kind ? { kind } : {}, take);
}

export async function topRated(kind?: Kind, take = 10) {
  return many({ ...(kind ? { kind } : {}), rating: { not: null } }, take, { rating: "desc" });
}

export async function byGenre(kind?: Kind, maxRows = 6): Promise<{ genre: string; items: TitleDTO[] }[]> {
  const all = await many(kind ? { kind } : {});
  const map = new Map<string, TitleDTO[]>();
  for (const t of all) for (const g of t.genres) map.set(g, [...(map.get(g) ?? []), t]);
  return [...map.entries()]
    .filter(([, items]) => items.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxRows)
    .map(([genre, items]) => ({ genre, items: items.slice(0, 20) }));
}

export async function heroCandidates(kind?:Kind):Promise<TitleDTO[]>{
 const candidates=await many({...(kind?{kind}:{}),backdropUrl:{not:null},overview:{not:null},episodes:{some:{}}},12,{rating:"desc"});
 return candidates.length?candidates:many({...(kind?{kind}:{}),episodes:{some:{}}},12);
}
const previousHero=new Map<string,number>();
export async function heroPick(kind?:Kind):Promise<TitleDTO|null>{
 const key=kind??"all",candidates=await heroCandidates(kind);const next=chooseHero(candidates,previousHero.get(key)??null);if(next)previousHero.set(key,next.id);return next;
}

export async function kindAll(kind: Kind) {
  return many({ kind }, undefined, { title: "asc" });
}

export async function myList() {
  const items = await prisma.listItem.findMany({ orderBy: { addedAt: "desc" }, select: { titleId: true } });
  if (!items.length) return [];
  const all = await many({ id: { in: items.map((i) => i.titleId) } });
  const order = new Map<number, number>(items.map((i: { titleId: number }, idx: number) => [i.titleId, idx] as [number, number]));
  return all.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function search(q: string) {
  const term = q.trim();
  if (!term) return [];
  // SQLite LIKE harf büyüklüğüne duyarsız (ASCII); Türkçe karakterler için iki başlıkta da arar
  return many({ OR: [{ title: { contains: term } }, { originalTitle: { contains: term } }] }, 60, { title: "asc" });
}

export interface EpisodeDTO {
  id: number;
  season: number;
  number: number;
  name: string | null;
  quality: string | null;
  seconds: number;
  duration: number;
}

export async function titleDetail(id: number) {
  const row = await prisma.title.findUnique({
    where: { id },
    include: { episodes: { include: { progress: true }, orderBy: [{ season: "asc" }, { number: "asc" }] } },
  });
  if (!row) return null;
  const [list,newIds] = await Promise.all([listIds(),newTitleIds()]);
  const dto = toDTO({ ...row, episodes: row.episodes.map((e) => ({ id: e.id, season: e.season, number: e.number, quality: e.quality })) }, list,newIds);
  const episodes: EpisodeDTO[] = row.episodes.map((e) => ({
    id: e.id,
    season: e.season,
    number: e.number,
    name: e.name,
    quality: e.quality,
    seconds: e.progress?.seconds ?? 0,
    duration: e.progress?.duration ?? 0,
  }));
  const last = row.episodes.filter((e) => e.progress && e.progress.seconds > 20).sort((a, b) => +b.progress!.updatedAt - +a.progress!.updatedAt)[0];
  dto.resumeEpisodeId = last?.id ?? null;
  const similar = (await many({ kind: row.kind, id: { not: id } }, 40)).filter((t) => t.genres.some((g) => dto.genres.includes(g))).slice(0, 12);
  return { title: dto, episodes, similar };
}

export async function episodeForPlayer(id: number) {
  const ep = await prisma.episode.findUnique({
    where: { id },
    include: { title: true, progress: true },
  });
  if (!ep) return null;
  const siblings = await prisma.episode.findMany({
    where: { titleId: ep.titleId },
    orderBy: [{ season: "asc" }, { number: "asc" }],
    select: { id: true, season: true, number: true, name: true },
  });
  const idx = siblings.findIndex((s) => s.id === id);
  return {
    episode: { id: ep.id, season: ep.season, number: ep.number, name: ep.name, filePath: ep.filePath, startAt: ep.progress?.seconds ?? 0 },
    title: { id: ep.title.id, title: ep.title.title, kind: ep.title.kind },
    nextId: siblings[idx + 1]?.id ?? null,
    siblings,
  };
}

export async function kindCount(kind:Kind){return prisma.title.count({where:{kind}});}
