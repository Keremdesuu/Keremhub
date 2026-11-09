import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { LIBRARY_DIR } from "@/lib/config";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  epub: "application/epub+zip",
  kepub: "application/epub+zip",
  pdf: "application/pdf",
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const book = await db.book.findUnique({ where: { id: Number(id) } });
  if (!book) return new Response("Kitap bulunamadı", { status: 404 });

  // Yol, tarama sırasında kaydedilen göreli yoldan gelir; kütüphane dışına çıkılamaz.
  const abs = path.resolve(LIBRARY_DIR, book.relPath);
  if (!abs.startsWith(path.resolve(LIBRARY_DIR) + path.sep)) return new Response("Geçersiz yol", { status: 400 });

  let stat;
  try {
    stat = await fs.promises.stat(abs);
  } catch {
    return new Response("Dosya diskte yok (HDD bağlı mı? Kütüphaneyi yeniden tarayın)", { status: 404 });
  }

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const ext = book.format === "pdf" ? "pdf" : book.format === "kepub" ? "kepub.epub" : "epub";
  const safeName = `${book.title}.${ext}`.replace(/[\\/:*?"<>|]+/g, " ");
  const headers = new Headers({
    "Content-Type": TYPES[book.format] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "Cache-Control": "private, max-age=3600",
  });

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(0, stat.size - Number(range[2]));
    }
    if (start > end || start >= stat.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  headers.set("Content-Length", String(end - start + 1));

  const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
}
