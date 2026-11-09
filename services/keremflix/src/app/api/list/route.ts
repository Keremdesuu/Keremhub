import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const body = z.object({ titleId: z.number().int() });

/** Listem'e ekler; zaten varsa çıkarır. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  const { titleId } = parsed.data;
  const existing = await prisma.listItem.findUnique({ where: { titleId } });
  if (existing) {
    await prisma.listItem.delete({ where: { titleId } });
    return Response.json({ inList: false });
  }
  await prisma.listItem.create({ data: { titleId } });
  return Response.json({ inList: true });
}
