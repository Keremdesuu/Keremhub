import { requireLibraryMount } from "./scan-safety";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db } from "./db";
import { COVERS_DIR, LAYOUT, LIBRARY_DIR } from "./config";
import { readEpubMeta, type EpubMeta } from "./epub-meta";

export type ScanResult = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  errors: { file: string; message: string }[];
  tookMs: number;
};

const SKIP_DIRS = new Set(["@eaDir", "$RECYCLE.BIN", "System Volume Information", "lost+found", ".Trash-1000"]);

function formatOf(name: string): "epub" | "kepub" | "pdf" | null {
  const n = name.toLowerCase();
  if (n.endsWith(".kepub.epub") || n.endsWith(".kepub")) return "kepub";
  if (n.endsWith(".epub")) return "epub";
  if (n.endsWith(".pdf")) return "pdf";
  return null;
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Klasör okunamadı; kayıt silme iptal edildi: ${dir}`, { cause: error });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  for (const e of entries) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && formatOf(e.name)) yield full;
  }
}

function hueOf(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

function tidy(s: string) {
  return s.replace(/[_]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function nameOnly(file: string) {
  return tidy(path.basename(file).replace(/\.(kepub\.epub|kepub|epub|pdf)$/i, ""));
}

const cleanGenre = (g: string) => g.replace(/\s+/g, " ").trim();

type Draft = {
  title: string;
  author?: string;
  series?: string;
  seriesIndex?: number;
  genres: string[];
  meta?: EpubMeta;
};

function fromFolders(rel: string): { author?: string; series?: string; genre?: string } {
  const dirs = rel.split(path.sep).slice(0, -1).map(tidy);
  if (LAYOUT === "flat" || dirs.length === 0) return {};
  if (LAYOUT === "genre-author") return { genre: dirs[0], author: dirs[1], series: dirs[2] };
  if (LAYOUT === "author-series") return { author: dirs[0], series: dirs[1] };
  // auto: Yazar/Seri/Kitap veya Yazar/Kitap
  return { author: dirs[0], series: dirs.length >= 2 ? dirs[dirs.length - 1] : undefined };
}

function buildDraft(rel: string, format: string, meta?: EpubMeta): Draft {
  const folder = fromFolders(rel);
  let title = meta?.title?.trim();
  let author = meta?.authors.join(", ") || undefined;
  let seriesIndex = meta?.seriesIndex;

  let base = nameOnly(rel);
  const num = base.match(/^(\d+(?:[.,]\d+)?)\s*[-._)]\s*(.+)$/);
  if (num) {
    if (seriesIndex === undefined) seriesIndex = Number(num[1].replace(",", "."));
    base = num[2];
  }
  if (!title) {
    // "Yazar - Kitap" kalıbı
    const dash = base.split(/\s+-\s+/);
    if (dash.length === 2 && !author && !folder.author) {
      author = dash[0];
      title = dash[1];
    } else {
      title = base;
    }
  }
  const genres = [...(meta?.subjects ?? []), ...(folder.genre ? [folder.genre] : [])]
    .map(cleanGenre)
    .filter(Boolean);
  return {
    title,
    author: author ?? folder.author,
    series: meta?.series ?? folder.series,
    seriesIndex,
    genres: [...new Map(genres.map((g) => [g.toLowerCase(), g])).values()].slice(0, 6),
    meta,
  };
}

let running = false;

export async function scanLibrary(options: { removeMissing?: boolean } = {}): Promise<ScanResult> {
  if (running) throw new Error("Tarama zaten sürüyor");
  running = true;
  const started = Date.now();
  const result: ScanResult = { added: 0, updated: 0, removed: 0, unchanged: 0, errors: [], tookMs: 0 };
  try {
    requireLibraryMount(LIBRARY_DIR);
    await fs.mkdir(COVERS_DIR, { recursive: true });
    try {
      await fs.access(LIBRARY_DIR);
    } catch {
      throw new Error(`Kitap klasörü bulunamadı: ${LIBRARY_DIR} (HDD bağlı mı?)`);
    }

    const existing = new Map((await db.book.findMany({ select: { id: true, relPath: true, sizeBytes: true, mtimeMs: true, metadataLocked: true, coverLocked: true } })).map((b) => [b.relPath, b]));
    const seen = new Set<string>();

    for await (const abs of walk(LIBRARY_DIR)) {
      const rel = path.relative(LIBRARY_DIR, abs);
      seen.add(rel);
      try {
        const st = await fs.stat(abs);
        const prev = existing.get(rel);
        if (prev && prev.sizeBytes === st.size && Math.abs(prev.mtimeMs - st.mtimeMs) < 1) {
          result.unchanged++;
          continue;
        }
        const format = formatOf(abs)!;
        let meta: EpubMeta | undefined;
        if (format !== "pdf") {
          try {
            meta = readEpubMeta(abs);
          } catch (e) {
            result.errors.push({ file: rel, message: `Üstveri okunamadı: ${(e as Error).message}` });
          }
        }
        const d = buildDraft(rel, format, meta);

        const data = {
          relPath: rel,
          format,
          sizeBytes: st.size,
          mtimeMs: st.mtimeMs,
          title: d.title,
          description: meta?.description ?? null,
          language: meta?.language ?? null,
          publisher: meta?.publisher ?? null,
          year: meta?.year ?? null,
          seriesIndex: d.seriesIndex ?? null,
          coverHue: hueOf(d.title),
          author: d.author
            ? { connectOrCreate: { where: { name: d.author }, create: { name: d.author } } }
            : { disconnect: true as const },
          series: d.series
            ? { connectOrCreate: { where: { name: d.series }, create: { name: d.series } } }
            : { disconnect: true as const },
          genres: {
            set: [],
            connectOrCreate: d.genres.map((name) => ({ where: { name }, create: { name } })),
          },
        };

        let id: number;
        if (prev) {
          if (prev.metadataLocked) {
            await db.book.update({
              where: { id: prev.id },
              data: { relPath: rel, format, sizeBytes: st.size, mtimeMs: st.mtimeMs },
            });
          } else {
            await db.book.update({ where: { id: prev.id }, data });
          }
          id = prev.id;
          result.updated++;
        } else {
          const { author, series, ...rest } = data;
          const created = await db.book.create({
            data: {
              ...rest,
              ...(d.author ? { author } : {}),
              ...(d.series ? { series } : {}),
              genres: { connectOrCreate: d.genres.map((name) => ({ where: { name }, create: { name } })) },
            },
          });
          id = created.id;
          result.added++;
        }

        if (meta?.cover && !prev?.coverLocked) {
          try {
            await sharp(meta.cover)
              .resize({ width: 480, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toFile(path.join(COVERS_DIR, `${id}.webp`));
            await db.book.update({ where: { id }, data: { hasCover: true } });
          } catch (e) {
            result.errors.push({ file: rel, message: `Kapak işlenemedi: ${(e as Error).message}` });
          }
        }
      } catch (e) {
        result.errors.push({ file: rel, message: (e as Error).message });
      }
    }

    requireLibraryMount(LIBRARY_DIR);
    if (result.errors.length || options.removeMissing === false) return result;
    // Diskten silinen kitapları temizle
    for (const [rel, b] of existing) {
      if (seen.has(rel)) continue;
      await db.book.delete({ where: { id: b.id } });
      await fs.rm(path.join(COVERS_DIR, `${b.id}.webp`), { force: true });
      result.removed++;
    }
    await db.author.deleteMany({ where: { books: { none: {} } } });
    await db.series.deleteMany({ where: { books: { none: {} } } });
    await db.genre.deleteMany({ where: { books: { none: {} } } });
  } finally {
    running = false;
    result.tookMs = Date.now() - started;
  }
  return result;
}
