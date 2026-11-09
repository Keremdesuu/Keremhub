import { getJson, stripHtml } from "./http";
import type { Meta } from "./types";

interface Show {
  id: number; name: string; premiered?: string; summary?: string; genres?: string[];
  image?: { original?: string; medium?: string }; rating?: { average?: number }; runtime?: number;
  _embedded?: { cast?: { person: { name: string } }[] };
}

/** API anahtarı gerektirmeyen yedek kaynak (yalnızca diziler). */
export async function tvmazeShow(title: string): Promise<Meta | null> {
  const s = await getJson<Show>(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=cast`);
  if (!s) return null;
  const images=await getJson<{type:string;resolutions:{original?:{url:string;width:number;height:number}}}[]>(`https://api.tvmaze.com/shows/${s.id}/images`).catch(()=>null);
  const wide=images?.find(image=>image.type==="background"&&image.resolutions.original&&image.resolutions.original.width/image.resolutions.original.height>1.3)?.resolutions.original?.url;
  return {
    title: s.name,
    year: s.premiered ? Number(s.premiered.slice(0, 4)) : null,
    overview: stripHtml(s.summary),
    posterUrl: s.image?.original ?? s.image?.medium ?? null,
    backdropUrl: wide ?? null,
    genres: s.genres ?? [],
    cast: s._embedded?.cast?.slice(0, 5).map((c) => c.person.name) ?? [],
    moods: [],
    rating: s.rating?.average ?? null,
    runtime: s.runtime ?? null,
  };
}
