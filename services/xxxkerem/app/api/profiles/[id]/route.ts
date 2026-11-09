import { prepareAvatar } from "@/lib/avatar";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Geçersiz kimlik", { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { name?: string; hidden?: boolean; avatarMediaId?: number | null };
  const data: { name?: string; hidden?: boolean; avatarMediaId?: number | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "İsim boş olamaz" }, { status: 400 });
    const clash = await prisma.profile.findFirst({ where: { name, NOT: { id } } });
    if (clash) return Response.json({ error: "Bu isimde bir profil zaten var" }, { status: 409 });
    data.name = name;
  }
  if (!(await prisma.profile.findUnique({ where: { id } }))) return Response.json({ error: "Profil bulunamadı" }, { status: 404 });
  if (body.hidden !== undefined) {
    if (typeof body.hidden !== "boolean") return Response.json({ error: "Geçersiz gizlilik seçeneği" }, { status: 400 });
    data.hidden = body.hidden;
  }
  if (body.avatarMediaId !== undefined) {
    if (body.avatarMediaId !== null) {
      if (!Number.isSafeInteger(body.avatarMediaId) || body.avatarMediaId < 1) return Response.json({ error: "Geçersiz resim" }, { status: 400 });
      try { await prepareAvatar(body.avatarMediaId); } catch { return Response.json({ error: "Profil resmi kaydedilemedi; geçerli bir fotoğraf seçin" }, { status: 400 }); }
    }
    data.avatarMediaId = body.avatarMediaId;
  }
  const updated = await prisma.profile.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Geçersiz kimlik", { status: 400 });
  await prisma.profile.delete({ where: { id } });
  return Response.json({ ok: true });
}
