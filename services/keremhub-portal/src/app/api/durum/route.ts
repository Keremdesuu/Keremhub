import { NextResponse } from "next/server";
import { siteleriListele } from "@/lib/repo";
import { kontrolAdresi } from "@/lib/sites";

export const dynamic = "force-dynamic";

async function acikMi(url: string): Promise<boolean> {
  try {
    const target = new URL(url);
    if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "192.168.1.240"].includes(target.hostname) || target.username || target.password) return false;
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    res.body?.cancel().catch(() => {});
    return res.status < 400 || res.status === 401 || res.status === 403;
  } catch {
    return false;
  }
}

export async function GET() {
  const base = process.env.PING_BASE ?? "http://127.0.0.1";
  const siteler = await siteleriListele();
  const sonuclar = await Promise.all(
    siteler.map(async (s) => [s.id, await acikMi(kontrolAdresi(s.yol, base))] as const),
  );
  return NextResponse.json(Object.fromEntries(sonuclar));
}
