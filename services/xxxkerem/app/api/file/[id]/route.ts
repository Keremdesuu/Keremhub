import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { resolveMediaFile } from "@/lib/config";
import { mimeFor } from "@/lib/mime";



export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const media = await prisma.media.findUnique({ where: { id: Number(id) } });
  if (!media) return new Response("Bulunamadı", { status: 404 });

  const file = resolveMediaFile(new URL(req.url).searchParams.get("original") === "1" && media.kind === "IMAGE" ? media.path : media.avatarFile ?? media.path);
  if (!file) return new Response("Geçersiz yol", { status: 400 });

  let size: number;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    return new Response("Dosya yok", { status: 404 });
  }

  const type = mimeFor(path.extname(file));
  const range = req.headers.get("range");
  const base = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : NaN;
      let end = m[2] ? parseInt(m[2], 10) : NaN;
      if (Number.isNaN(start)) {
        // "bytes=-500" => son 500 bayt
        start = Math.max(size - end, 0);
        end = size - 1;
      } else if (Number.isNaN(end) || end >= size) end = size - 1;

      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const stream = fs.createReadStream(file, { start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          ...base,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const stream = fs.createReadStream(file);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: { ...base, "Content-Length": String(size) },
  });
}
