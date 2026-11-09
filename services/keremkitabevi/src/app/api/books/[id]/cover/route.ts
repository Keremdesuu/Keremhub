import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { COVERS_DIR } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: imageId } = await ctx.params;
  const match = /^(\d+)(?:-\d+)?$/.exec(imageId);
  if (!match) return new Response("Geçersiz", { status: 400 });
  try {
    const buf = await fs.readFile(path.join(COVERS_DIR, `${match[1]}.webp`));
    const asJpeg = new URL(req.url).searchParams.get("format") === "jpeg";
    const image = asJpeg ? await sharp(buf).jpeg({ quality: 90 }).toBuffer() : buf;
    return new Response(new Uint8Array(image), {
      headers: { "Content-Type": asJpeg ? "image/jpeg" : "image/webp", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Kapak yok", { status: 404 });
  }
}
