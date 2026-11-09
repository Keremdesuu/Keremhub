/** Dosya / klasör adlarından başlık, yıl, sezon, bölüm ve kalite çıkarır. */

const JUNK =
  /\b(2160p|1080p|720p|480p|4k|uhd|hdr10?\+?|hdr|dv|dolby ?vision|bluray|blu-ray|bdrip|brrip|web-?dl|web-?rip|hdtv|dvdrip|x26[45]|h\.?26[45]|hevc|av1|aac|ac3|dts|ddp?5?\.?1?|atmos|10bit|8bit|remux|proper|repack|extended|unrated|multi|dual|dublado|tr|turkce|türkçe)\b/gi;

export type Quality = "4K" | "HD" | null;

export function detectQuality(name: string): { quality: Quality; hdr: boolean } {
  const n = name.toLowerCase();
  const hdr = /hdr|dolby ?vision|\bdv\b/.test(n);
  if (/2160p|\b4k\b|uhd/.test(n)) return { quality: "4K", hdr };
  if (/1080p|720p|\bhd\b|bluray|web-?dl/.test(n)) return { quality: "HD", hdr };
  return { quality: null, hdr };
}

export function cleanTitle(raw: string): { title: string; year: number | null } {
  let s = raw.replace(/\.(?:mkv|mp4|m4v|webm|avi|mov|ts)$/i, "");
  s = s.replace(/\[[^\]]*\]/g, " "); // [Grup] [1080p]
  let year: number | null = null;
  const y = s.match(/[\s.(\[_-]((?:19|20)\d{2})[)\]]?(?=[\s.)\]_-]|$)/);
  if (y) {
    year = Number(y[1]);
    s = s.slice(0, y.index) + " " + s.slice((y.index ?? 0) + y[0].length);
  }
  s = s.replace(/[._]+/g, " ").replace(JUNK, " ");
  s = s.replace(/\(\s*\)/g, " ").replace(/\s+-\s*$/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  return { title: s, year };
}

export interface EpisodeInfo {
  season: number | null;
  number: number | null;
  name: string | null;
}

export function parseEpisode(fileName: string, folderSeason: number | null): EpisodeInfo {
  const base = fileName.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/\[[^\]]*\]/g, " ");
  let m = base.match(/s(\d{1,2})[\s._-]*e(\d{1,3})/i);
  if (m) return { season: Number(m[1]), number: Number(m[2]), name: null };
  m = base.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (m) return { season: Number(m[1]), number: Number(m[2]), name: null };
  m = base.match(/(?:\bep?|bölüm|bolum|episode)[\s._-]*(\d{1,4})\b/i);
  if (m) return { season: folderSeason, number: Number(m[1]), name: null };
  // Anime tarzı: "Başlık - 03"
  m = base.match(/\s-\s*(\d{1,4})(?:v\d)?\s*(?:$|[\s(])/);
  if (m) return { season: folderSeason, number: Number(m[1]), name: null };
  m = base.match(/(?:^|[\s._-])(\d{1,3})(?:$|[\s._-])/);
  if (m) return { season: folderSeason, number: Number(m[1]), name: null };
  return { season: folderSeason, number: null, name: null };
}

/** "Season 2", "Sezon 02", "S3" gibi klasör adlarından sezon numarası. */
export function parseSeasonFolder(name: string): number | null {
  const m = name.match(/^(?:season|sezon|s)[\s._-]*(\d{1,2})$/i);
  return m ? Number(m[1]) : null;
}
