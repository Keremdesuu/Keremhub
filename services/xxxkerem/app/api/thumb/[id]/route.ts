import fs from "node:fs/promises";
import { thumbPath } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response("Geçersiz", { status: 400 });
  try {
    const buf = await fs.readFile(thumbPath(n));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Yok", { status: 404 });
  }
}
