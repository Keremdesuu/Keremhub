import { needsMetadata } from "./metadata-policy";
import { requireLibraryMount } from "./scan-safety";
import fs from "node:fs/promises";
import path from "node:path";
import { config, kindFolder } from "./config";
import { prisma } from "./db";
import { fetchMetadata, type Kind } from "./metadata";
import { sleep } from "./metadata/http";
import { cleanTitle, detectQuality, parseEpisode, parseSeasonFolder } from "./parse";

const isVideo = (f: string) => config.videoExt.includes(path.extname(f).toLowerCase());

async function exists(p: string) {
  try { await fs.access(p); return true; } catch { return false; }
}

/** Klasör altındaki tüm video dosyalarını (alt klasörler dahil) toplar. */
async function walk(dir: string, season: number | null = null): Promise<{ file: string; season: number | null }[]> {
  const out: { file: string; season: number | null }[] = [];
  let entries;
  entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("@")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full, parseSeasonFolder(e.name) ?? season)));
    } else if (isVideo(e.name)) {
      out.push({ file: full, season });
    }
  }
  return out;
}

interface Found {
  folderName: string;
  displayName: string;
  files: { file: string; season: number | null }[];
}

/** Dizi/anime: her alt klasör bir başlık. Film: her alt klasör (veya doğrudan dosya) bir başlık. */
async function discover(kind: Kind): Promise<Found[]> {
  const root = kindFolder(kind);
  if (!(await exists(root))) throw new Error(`Medya klasörü okunamıyor; tarama iptal edildi: ${root}`);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const found: Found[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name.startsWith("@")) continue;
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      const files = await walk(full);
      if (files.length) found.push({ folderName: `${kind}:${e.name}`, displayName: e.name, files });
    } else if (kind === "MOVIE" && isVideo(e.name)) {
      found.push({ folderName: `${kind}:${e.name}`, displayName: e.name, files: [{ file: full, season: null }] });
    }
  }
  return found;
}

export interface ScanResult {
  titles: number;
  episodes: number;
  newTitles: number;
  removed: number;
  metaFetched: number;
  metaMissing: number;
}

export async function scanLibrary(opts: { refetchMissing?: boolean; log?: (m: string) => void } = {}): Promise<ScanResult> {
  requireLibraryMount(config.mediaRoot);
  const log = opts.log ?? (() => {});
  const result: ScanResult = { titles: 0, episodes: 0, newTitles: 0, removed: 0, metaFetched: 0, metaMissing: 0 };
  const seenPaths = new Set<string>();
  const seenTitles = new Set<string>();

  for (const kind of ["SERIES", "MOVIE", "ANIME"] as const) {
    const found = await discover(kind);
    log(`${kind}: ${found.length} başlık bulundu`);

    for (const f of found) {
      seenTitles.add(f.folderName);
      const { title: guessed, year: folderYear } = cleanTitle(f.displayName);
      const year=folderYear ?? (kind==="MOVIE" ? cleanTitle(path.basename(f.files[0].file)).year : null);
      const title = guessed || f.displayName;

      let row = await prisma.title.findUnique({ where: { folderName: f.folderName } });
      if (!row) {
        row = await prisma.title.create({ data: { kind, folderName: f.folderName, title, year } });
        result.newTitles++;
      }

      // Metadata: yalnızca ilk kez ya da daha önce bulunamayanlar için
      const needsMeta = needsMetadata(row,opts.refetchMissing);
      if (needsMeta) {
        const { meta, status } = await fetchMetadata(kind, title, year);
        await prisma.title.update({
          where: { id: row.id },
          data: meta
            ? {
                title: meta.title || title,
                originalTitle: meta.originalTitle ?? null,
                year: meta.year ?? year,
                overview: meta.overview ?? null,
                posterUrl: meta.posterUrl ?? row.posterUrl,
                backdropUrl: meta.backdropUrl ?? (row.backdropUrl !== row.posterUrl ? row.backdropUrl : null),
                genres: JSON.stringify(meta.genres),
                cast: JSON.stringify(meta.cast),
                moods: JSON.stringify(meta.moods),
                rating: meta.rating ?? null,
                certification: meta.certification ?? null,
                runtime: meta.runtime ?? null,
                tmdbId: meta.tmdbId ?? null,
                anilistId: meta.anilistId ?? null,
                metaStatus: status,
              }
            : { metaStatus: status },
        });
        if (meta) result.metaFetched++;
        else result.metaMissing++;
        log(`  metadata ${status}: ${title}`);
        await sleep(350); // API'lere nazik davran
      }

      // Bölümler
      let fallbackNo = 1;
      const sorted = [...f.files].sort((a, b) => a.file.localeCompare(b.file, "tr", { numeric: true }));
      for (const { file, season } of sorted) {
        seenPaths.add(file);
        const base = path.basename(file);
        const ep = parseEpisode(base, season);
        const q = detectQuality(file);
        const stat = await fs.stat(file);
        const isMovie = kind === "MOVIE";
        const data = {
          titleId: row.id,
          season: isMovie ? 1 : ep.season ?? season ?? 1,
          number: isMovie ? fallbackNo++ : ep.number ?? fallbackNo++,
          quality: q.hdr ? (q.quality ? `${q.quality}+HDR` : "HDR") : q.quality,
          sizeBytes: BigInt(stat.size),
        };
        await prisma.episode.upsert({
          where: { filePath: file },
          create: { ...data, filePath: file, name: cleanTitle(base).title },
          update: data,
        });
        result.episodes++;
      }
      result.titles++;
    }
  }

  requireLibraryMount(config.mediaRoot);
  // Diskten silinenleri temizle
  const allEps = await prisma.episode.findMany({ select: { id: true, filePath: true } });
  const gone = allEps.filter((e) => !seenPaths.has(e.filePath)).map((e) => e.id);
  if (gone.length) {
    await prisma.episode.deleteMany({ where: { id: { in: gone } } });
    result.removed = gone.length;
  }
  const emptyTitles = await prisma.title.findMany({ where: { episodes: { none: {} } }, select: { id: true } });
  if (emptyTitles.length) await prisma.title.deleteMany({ where: { id: { in: emptyTitles.map((t) => t.id) } } });

  return result;
}
