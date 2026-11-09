import { NextResponse } from "next/server";
import { siteEkle, siteleriListele } from "@/lib/repo";
import { siteSchema } from "@/lib/sites";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await siteleriListele());
}

export async function POST(req: Request) {
  const govde = await req.json().catch(() => null);
  const sonuc = siteSchema.safeParse(govde);
  if (!sonuc.success) {
    return NextResponse.json({ hata: sonuc.error.issues[0]?.message ?? "Geçersiz bilgi" }, { status: 400 });
  }
  return NextResponse.json(await siteEkle(sonuc.data), { status: 201 });
}
