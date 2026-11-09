import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return new Response("Geçersiz kimlik", { status: 400 });
  await prisma.media.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});
  return Response.json({ ok: true });
}
