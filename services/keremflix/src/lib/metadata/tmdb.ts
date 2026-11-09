import { config } from "../config";
import { getJson } from "./http";
import type { Meta } from "./types";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

function auth(url: URL): RequestInit {
  const key = config.tmdbKey;
  // Uzun anahtar = "API Read Access Token" (Bearer), kısa = klasik v3 anahtar
  if (key.length > 40) return { headers: { Authorization: `Bearer ${key}` } };
  url.searchParams.set("api_key", key);
  return {};
}

function endpoint(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const init = auth(url);
  return { url: url.toString(), init };
}

interface SearchResp { results: { id: number }[] }
interface Credits { cast?: { name: string }[] }
interface Genre { name: string }
interface ImageSet { posters?:{file_path:string;aspect_ratio:number}[];backdrops?:{file_path:string;aspect_ratio:number}[] }
async function extraImages(type:"movie"|"tv",id:number){const e=endpoint(`/${type}/${id}/images`,{include_image_language:"tr,en,null"});return getJson<ImageSet>(e.url,e.init);}


interface TvDetail {
  id: number; name: string; original_name?: string; overview?: string;
  first_air_date?: string; poster_path?: string; backdrop_path?: string;
  genres?: Genre[]; vote_average?: number; episode_run_time?: number[];
  credits?: Credits;
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  keywords?: { results: { name: string }[] };
}

interface MovieDetail {
  id: number; title: string; original_title?: string; overview?: string;
  release_date?: string; poster_path?: string; backdrop_path?: string;
  genres?: Genre[]; vote_average?: number; runtime?: number;
  credits?: Credits;
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
  keywords?: { keywords: { name: string }[] };
}

const year = (d?: string) => (d && d.length >= 4 ? Number(d.slice(0, 4)) : null);

export async function tmdbTv(title: string, y: number | null): Promise<Meta | null> {
  const s = endpoint("/search/tv", { query: title, language: config.lang, first_air_date_year: y ?? undefined });
  const found = await getJson<SearchResp>(s.url, s.init);
  const id = found?.results?.[0]?.id;
  if (!id) return null;
  const d = endpoint(`/tv/${id}`, { language: config.lang, append_to_response: "credits,content_ratings,keywords" });
  const t = await getJson<TvDetail>(d.url, d.init);
  if (!t) return null;
  const images=(!t.poster_path||!t.backdrop_path)?await extraImages("tv",t.id).catch(()=>null):null;
  t.poster_path ||= images?.posters?.find(x=>x.aspect_ratio<1)?.file_path;
  t.backdrop_path ||= images?.backdrops?.find(x=>x.aspect_ratio>1.3)?.file_path;
  const cert = t.content_ratings?.results.find((r) => r.iso_3166_1 === "TR") ?? t.content_ratings?.results.find((r) => r.iso_3166_1 === "US");
  return {
    title: t.name,
    originalTitle: t.original_name,
    year: year(t.first_air_date),
    overview: t.overview || null,
    posterUrl: t.poster_path ? `${IMG}/w500${t.poster_path}` : null,
    backdropUrl: t.backdrop_path ? `${IMG}/w1280${t.backdrop_path}` : null,
    genres: t.genres?.map((g) => g.name) ?? [],
    cast: t.credits?.cast?.slice(0, 5).map((c) => c.name) ?? [],
    moods: t.keywords?.results?.slice(0, 3).map((k) => k.name) ?? [],
    rating: t.vote_average ?? null,
    certification: cert?.rating ?? null,
    runtime: t.episode_run_time?.[0] ?? null,
    tmdbId: t.id,
  };
}

export async function tmdbMovie(title: string, y: number | null): Promise<Meta | null> {
  const s = endpoint("/search/movie", { query: title, language: config.lang, year: y ?? undefined });
  const found = await getJson<SearchResp>(s.url, s.init);
  const id = found?.results?.[0]?.id;
  if (!id) return null;
  return tmdbMovieById(id);
}

export async function tmdbMovieById(id: number): Promise<Meta | null> {
  const d = endpoint(`/movie/${id}`, { language: config.lang, append_to_response: "credits,release_dates,keywords" });
  const m = await getJson<MovieDetail>(d.url, d.init);
  if (!m) return null;
  const images=(!m.poster_path||!m.backdrop_path)?await extraImages("movie",m.id).catch(()=>null):null;
  m.poster_path ||= images?.posters?.find(x=>x.aspect_ratio<1)?.file_path;
  m.backdrop_path ||= images?.backdrops?.find(x=>x.aspect_ratio>1.3)?.file_path;
  const rd = m.release_dates?.results;
  const pick = rd?.find((r) => r.iso_3166_1 === "TR") ?? rd?.find((r) => r.iso_3166_1 === "US");
  const cert = pick?.release_dates.find((x) => x.certification)?.certification ?? null;
  return {
    title: m.title,
    originalTitle: m.original_title,
    year: year(m.release_date),
    overview: m.overview || null,
    posterUrl: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
    backdropUrl: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
    genres: m.genres?.map((g) => g.name) ?? [],
    cast: m.credits?.cast?.slice(0, 5).map((c) => c.name) ?? [],
    moods: m.keywords?.keywords?.slice(0, 3).map((k) => k.name) ?? [],
    rating: m.vote_average ?? null,
    certification: cert,
    runtime: m.runtime ?? null,
    tmdbId: m.id,
  };
}

export async function searchMovies(query: string) {
 const e=endpoint("/search/movie",{query,language:config.lang});
 const data=await getJson<{results:{id:number;title:string;original_title?:string;release_date?:string;poster_path?:string}[]}>(e.url,e.init);
 return (data?.results??[]).slice(0,20).map(m=>({id:m.id,title:m.title,originalTitle:m.original_title,year:year(m.release_date),posterUrl:m.poster_path?`${IMG}/w185${m.poster_path}`:null}));
}
