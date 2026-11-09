import { z } from "zod";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const body = z.object({ episodeId: z.number().int(), seconds: z.number().min(0), duration: z.number().min(0) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçersiz istek" }, { status: 400 });
  const { episodeId, seconds, duration } = parsed.data;
  const exists = await prisma.episode.findUnique({ where: { id: episodeId }, select: { id: true } });
  if (!exists) return Response.json({ error: "Bölüm yok" }, { status: 404 });
  await prisma.progress.upsert({
    where: { episodeId },
    create: { episodeId, seconds, duration },
    update: { seconds, duration },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req:Request){
 const b=z.object({titleId:z.number().int().positive()}).safeParse(await req.json().catch(()=>null));
 if(!b.success)return Response.json({error:"Geçersiz istek"},{status:400});
 const t=await prisma.title.findUnique({where:{id:b.data.titleId},select:{id:true}});
 if(!t)return Response.json({error:"Başlık yok"},{status:404});
 await prisma.progress.deleteMany({where:{episode:{titleId:t.id}}});
 return Response.json({ok:true});
}
