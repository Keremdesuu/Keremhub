import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { requireLibraryMount } from "./scan-safety";
export const MAX_BOOK_BYTES = 50 * 1024 * 1024;
export class UploadError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function bookFileName(input: string) {
  const name = input.normalize("NFC").trim();
  if (!name || /[\\/\x00-\x1f\x7f]/.test(name) || name.startsWith(".") || Buffer.byteLength(name) > 220) throw new UploadError("Dosya adı geçersiz veya çok uzun.");
  if (!/\.(epub|kepub|pdf)$/i.test(name)) throw new UploadError("Yalnızca EPUB, KEPUB ve PDF dosyaları yüklenebilir.");
  return name.replace(/[:*?"<>|]/g, "_");
}
export async function saveBookUpload(root: string, name: string, body: ReadableStream<Uint8Array> | null, size: number) {
  name = bookFileName(name);
  if (!body || !Number.isSafeInteger(size) || size <= 0) throw new UploadError("Dosya boş veya boyutu okunamıyor.");
  if (size > MAX_BOOK_BYTES) throw new UploadError("Dosya en fazla 50 MB olabilir.", 413);
  requireLibraryMount(root);
  const dir = await fs.realpath(root);
  const space = await fs.statfs(dir);
  if (space.bavail * space.bsize < size + 50 * 1024 * 1024) throw new UploadError("HDD üzerinde yeterli boş alan yok.", 507);
  const temp = path.join(dir, `.upload-${randomUUID()}.part`);
  let bytes = 0;
  try {
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), new Transform({ transform(chunk, encoding, callback) { bytes += chunk.length; if (bytes > MAX_BOOK_BYTES || bytes > size) callback(new UploadError("Dosya boyutu sınırı aşıldı.", 413)); else callback(null, chunk); } }), createWriteStream(temp, { flags: "wx", mode: 0o600 }));
    if (bytes !== size) throw new UploadError("Dosya eksik aktarıldı. Tekrar dene.");
    const handle = await fs.open(temp, "r");
    const magic = Buffer.alloc(5);
    try { await handle.read(magic, 0, 5, 0); } finally { await handle.close(); }
    const pdf = /\.pdf$/i.test(name);
    if (pdf ? magic.toString("ascii") !== "%PDF-" : magic.readUInt32LE(0) !== 0x04034b50) throw new UploadError("Dosya içeriği seçilen kitap biçimiyle uyuşmuyor.");
    const extension = /\.kepub\.epub$/i.test(name) ? name.slice(-11) : path.extname(name);
    const stem = name.slice(0, -extension.length);
    requireLibraryMount(root);
    for (let n = 0; n < 1000; n++) {
      const candidate = n ? `${stem} (${n + 1})${extension}` : name;
      try { await fs.link(temp, path.join(dir, candidate)); return { name: candidate, bytes }; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    }
    throw new UploadError("Bu adla çok fazla dosya var. Dosyanın adını değiştir.", 409);
  } finally { await fs.rm(temp, { force: true }); }
}
