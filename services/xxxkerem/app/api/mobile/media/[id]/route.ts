import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return Response.json({ error: "Geçersiz kimlik" }, { status: 400 });
  const media = await prisma.media.findUnique({ where: { id: Number(id) }, include: { profiles: { select: { id: true, name: true } } } });
  if (!media) return Response.json({ error: "Medya bulunamadı" }, { status: 404 });
  return Response.json({ version: 1, media }, { headers: { "Cache-Control": "no-store" } });
}
