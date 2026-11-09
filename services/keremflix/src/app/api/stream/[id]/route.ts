import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";



export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".ts": "video/mp2t",
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const ep = await prisma.episode.findUnique({ where: { id: Number(id) }, select: { filePath: true } });
  if (!ep) return new Response("Bulunamadı", { status: 404 });

  let stat: fs.Stats;
  try { stat = await fs.promises.stat(ep.filePath); } catch { return new Response("Dosya diskte yok", { status: 404 }); }

  const size = stat.size;
  const type = MIME[path.extname(ep.filePath).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range");

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  let start = 0;
  let end = size - 1;
  let status = 200;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1] === "" && m[2] !== "") {
        start = Math.max(0, size - Number(m[2]));
      } else {
        start = m[1] ? Number(m[1]) : 0;
        end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      }
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      status = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
  }
  headers["Content-Length"] = String(end - start + 1);

  const stream = fs.createReadStream(ep.filePath, { start, end });
  req.signal.addEventListener("abort", () => stream.destroy());
  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers });
}
