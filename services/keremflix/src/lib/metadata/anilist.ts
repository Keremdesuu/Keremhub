import { getJson, stripHtml } from "./http";
import type { Meta } from "./types";

const QUERY = `
query ($search: String) {
  Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
    id
    title { romaji english native }
    seasonYear
    description(asHtml: false)
    genres
    tags { name rank isMediaSpoiler }
    averageScore
    duration
    coverImage { extraLarge }
    bannerImage
    isAdult
    characters(sort: ROLE, perPage: 5) { nodes { name { full } } }
  }
}`;

interface Resp {
  data?: {
    Media?: {
      id: number;
      title: { romaji?: string; english?: string; native?: string };
      seasonYear?: number;
      description?: string;
      genres?: string[];
      tags?: { name: string; rank: number; isMediaSpoiler: boolean }[];
      averageScore?: number;
      duration?: number;
      coverImage?: { extraLarge?: string };
      bannerImage?: string;
      isAdult?: boolean;
      characters?: { nodes: { name: { full: string } }[] };
    };
  };
}

export async function anilistAnime(title: string): Promise<Meta | null> {
  const r = await getJson<Resp>("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { search: title } }),
  });
  const m = r?.data?.Media;
  if (!m) return null;
  return {
    title: m.title.english ?? m.title.romaji ?? title,
    originalTitle: m.title.romaji ?? m.title.native ?? null,
    year: m.seasonYear ?? null,
    overview: stripHtml(m.description),
    posterUrl: m.coverImage?.extraLarge ?? null,
    backdropUrl: m.bannerImage ?? null,
    genres: m.genres ?? [],
    cast: m.characters?.nodes.map((n) => n.name.full) ?? [],
    moods: (m.tags ?? []).filter((t) => !t.isMediaSpoiler).sort((a, b) => b.rank - a.rank).slice(0, 3).map((t) => t.name),
    rating: m.averageScore ? m.averageScore / 10 : null,
    certification: m.isAdult ? "18+" : null,
    runtime: m.duration ?? null,
    anilistId: m.id,
  };
}
