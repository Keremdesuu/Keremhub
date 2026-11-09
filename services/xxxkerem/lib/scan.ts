import { requireLibraryMount } from "./scan-safety";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { prisma } from "./prisma";
import { IMAGE_EXT, MEDIA_DIR, THUMB_DIR, UPLOAD_DIR, UPLOAD_PREFIX, PROFILE_DIR, resolveMediaFile, VIDEO_EXT } from "./config";

const run = promisify(execFile);

async function* walkAll(): AsyncGenerator<{ file: string; rel: string }> {
  const roots = [
    { root: MEDIA_DIR, prefix: "" },
    ...(!path.relative(MEDIA_DIR, UPLOAD_DIR).startsWith("..") && !path.isAbsolute(path.relative(MEDIA_DIR, UPLOAD_DIR)) ? [] : [{ root: UPLOAD_DIR, prefix: UPLOAD_PREFIX }]),
  ];
  for (const { root, prefix } of roots) {
    for await (const file of walk(root)) yield { file, rel: prefix + path.relative(root, file) };
  }
}

export type ScanResult = { added: number; removed: number; total: number; errors: number };

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Klasör okunamadı; kayıt silme iptal edildi: ${dir}`, { cause: error });
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "@eaDir") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (path.resolve(full) !== PROFILE_DIR) yield* walk(full);
    }
    else if (e.isFile()) yield full;
  }
}

export function titleFromFile(file: string): string {
  return path
    .basename(file, path.extname(file))
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function probeVideo(file: string) {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      file,
    ]);
    const j = JSON.parse(stdout);
    return {
      duration: j.format?.duration ? Math.round(Number(j.format.duration)) : null,
      width: j.streams?.[0]?.width ?? null,
      height: j.streams?.[0]?.height ?? null,
    };
  } catch {
    return { duration: null, width: null, height: null };
  }
}

export function thumbPath(id: number) {
  return path.join(THUMB_DIR, `${id}.jpg`);
}

export async function makeVideoThumb(id: number, file: string, duration: number | null) {
  const out = thumbPath(id);
  const at = duration && duration > 10 ? Math.floor(duration * 0.1) : 0;
  await run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-ss", String(at),
    "-i", file,
    "-frames:v", "1",
    "-vf", "scale=480:-2,format=yuvj420p",
    "-threads", "1",
    "-q:v", "4",
    out,
  ]);
}

export async function makeImageThumb(id: number, file: string) {
  await sharp(file, { animated: false })
    .rotate()
    .resize({ width: 480, height: 480, fit: "cover" })
    .jpeg({ quality: 78 })
    .toFile(thumbPath(id));
}

export async function imageSize(file: string) {
  try {
    const m = await sharp(file).metadata();
    return { width: m.width ?? null, height: m.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

export async function scanLibrary(): Promise<ScanResult> {
  requireLibraryMount(MEDIA_DIR);
  await fs.mkdir(THUMB_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await fs.access(MEDIA_DIR);
  } catch {
    throw new Error(`Medya klasörü bulunamadı: ${MEDIA_DIR} (HDD bağlı mı?)`);
  }

  const rows: { id: number; path: string }[] = await prisma.media.findMany({ select: { id: true, path: true } });
  const known = new Map<string, number>(rows.map((m) => {
    const abs = resolveMediaFile(m.path);
    const rel = abs ? path.relative(MEDIA_DIR, abs) : "..";
    return [!rel.startsWith("..") && !path.isAbsolute(rel) ? rel : m.path, m.id];
  }));
  const seen = new Set<string>();
  let added = 0;
  let errors = 0;

  for await (const { file, rel } of walkAll()) {
    const ext = path.extname(file).toLowerCase();
    const isVideo = VIDEO_EXT.has(ext);
    const isImage = IMAGE_EXT.has(ext);
    if (!isVideo && !isImage) continue;

    seen.add(rel);

    const existingId = known.get(rel);
    if (existingId) {
      // küçük resim eksikse yeniden üret
      try {
        await fs.access(thumbPath(existingId));
      } catch {
        try {
          if (isVideo) {
            const p = await probeVideo(file);
            await makeVideoThumb(existingId, file, p.duration);
          } else await makeImageThumb(existingId, file);
        } catch {
          errors++;
        }
      }
      continue;
    }

    try {
      const stat = await fs.stat(file);
      const meta = isVideo ? await probeVideo(file) : { duration: null, ...(await imageSize(file)) };
      const row = await prisma.media.create({
        data: {
          kind: isVideo ? "VIDEO" : "IMAGE",
          path: rel,
          title: titleFromFile(file),
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          mtime: stat.mtime,
        },
      });
      try {
        if (isVideo) await makeVideoThumb(row.id, file, meta.duration);
        else await makeImageThumb(row.id, file);
      } catch {
        errors++;
      }
      added++;
    } catch {
      errors++;
    }
  }

  requireLibraryMount(MEDIA_DIR);
  // diskten silinmiş dosyaları kütüphaneden kaldır
  // HDD takılı değilse / klasör boşsa HDD kayıtlarını silme (profiller kaybolmasın)
  const hddSeen = [...seen].some((p) => !p.startsWith(UPLOAD_PREFIX));
  const protectedAvatars = new Set((await prisma.media.findMany({ where: { isAvatar: true }, select: { id: true } })).map(m => m.id));
  const missing = [...known.entries()].filter(([p, id]) => !protectedAvatars.has(id) && !seen.has(p) && (hddSeen || p.startsWith(UPLOAD_PREFIX)));
  for (const [, id] of missing) {
    await prisma.media.delete({ where: { id } }).catch(() => {});
    await fs.rm(thumbPath(id), { force: true });
  }

  const total = await prisma.media.count();
  return { added, removed: missing.length, total, errors };
}
