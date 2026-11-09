import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const profiles = await prisma.profile.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarMediaId: true, _count: { select: { media: true } } },
    take: 200,
  });
  return Response.json(profiles);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) return Response.json({ error: "İsim gerekli" }, { status: 400 });
  const existing = await prisma.profile.findUnique({ where: { name } });
  if (existing) return Response.json(existing);
  return Response.json(await prisma.profile.create({ data: { name } }), { status: 201 });
}
