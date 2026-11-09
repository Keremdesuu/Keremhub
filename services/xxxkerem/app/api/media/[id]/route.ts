import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// { title?: string, profileIds?: number[] }  — profileIds verilirse liste tamamen değiştirilir
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { title?: string; profileIds?: number[] };
  const data: { title?: string; profiles?: { set: { id: number }[] } } = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return Response.json({ error: "Başlık boş olamaz" }, { status: 400 });
    data.title = t;
  }
  if (Array.isArray(body.profileIds)) {
    data.profiles = { set: body.profileIds.filter(Number.isInteger).map((pid) => ({ id: pid })) };
  }
  const media = await prisma.media.update({
    where: { id },
    data,
    include: { profiles: { select: { id: true, name: true, avatarMediaId: true } } },
  });
  return Response.json(media);
}

// A destructive action requires explicit confirmation from the UI.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Geçersiz kimlik" }, { status: 400 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && new URL(origin).host !== host) return Response.json({ error: "Geçersiz istek" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (body?.confirmed !== true) return Response.json({ error: "Silme onayı gerekli" }, { status: 400 });
  try {
    const { deleteMedia } = await import("@/lib/delete-media");
    if (!await deleteMedia(id)) return Response.json({ error: "Medya bulunamadı" }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Silme tamamlanamadı. HDD bağlantısını ve dosya izinlerini kontrol edip tekrar deneyin." }, { status: 500 });
  }
}
