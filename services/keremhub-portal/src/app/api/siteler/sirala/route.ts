import { NextResponse } from "next/server";
import { z } from "zod";
import { siraKaydet } from "@/lib/repo";

export const dynamic = "force-dynamic";

const sema = z.object({ idler: z.array(z.number().int()).max(500) });

export async function PUT(req: Request) {
  const sonuc = sema.safeParse(await req.json().catch(() => null));
  if (!sonuc.success) return NextResponse.json({ hata: "Sıralama listesi geçersiz" }, { status: 400 });
  await siraKaydet(sonuc.data.idler);
  return NextResponse.json({ tamam: true });
}
