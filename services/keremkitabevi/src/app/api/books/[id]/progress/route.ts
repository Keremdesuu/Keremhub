import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const p = await db.progress.findUnique({ where: { bookId: Number(id) } });
  return NextResponse.json(p ? { location: p.location, percent: p.percent } : null);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const body = (await req.json().catch(() => null)) as { location?: string; percent?: number } | null;
  if (!body || typeof body.location !== "string") return NextResponse.json({ error: "location gerekli" }, { status: 400 });
  const percent = Math.min(1, Math.max(0, Number(body.percent) || 0));
  const bookId = Number(id);
  if (!(await db.book.findUnique({ where: { id: bookId }, select: { id: true } })))
    return NextResponse.json({ error: "Kitap yok" }, { status: 404 });
  await db.progress.upsert({
    where: { bookId },
    create: { bookId, location: body.location, percent },
    update: { location: body.location, percent, koboLocation: null },
  });

  // Okurken takip kendiliğinden ilerler: başlayınca "Okunuyor", bitince "Okundu".
  // Elle "Okundu" işaretli kitaba (yeniden okuma) dokunulmaz.
  const entry = await db.readingEntry.findUnique({ where: { bookId } });
  const now = new Date();
  if (percent >= 0.98 && entry?.status !== "read") {
    await db.readingEntry.upsert({
      where: { bookId },
      create: { bookId, status: "read", startedAt: now, finishedAt: now },
      update: { status: "read", finishedAt: now },
    });
  } else if (percent > 0.01 && (!entry || entry.status === "want")) {
    await db.readingEntry.upsert({
      where: { bookId },
      create: { bookId, status: "reading", startedAt: now },
      update: { status: "reading", startedAt: entry?.startedAt ?? now },
    });
  }
  return NextResponse.json({ ok: true });
}
