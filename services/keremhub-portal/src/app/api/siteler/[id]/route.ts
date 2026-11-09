import { NextResponse } from "next/server";
import { siteGuncelle, siteSil } from "@/lib/repo";
import { siteGuncelle as guncelleSemasi } from "@/lib/sites";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function kimlik(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const id = await kimlik(ctx);
  if (id === null) return NextResponse.json({ hata: "Geçersiz site numarası" }, { status: 400 });
  const sonuc = guncelleSemasi.safeParse(await req.json().catch(() => null));
  if (!sonuc.success) {
    return NextResponse.json({ hata: sonuc.error.issues[0]?.message ?? "Geçersiz bilgi" }, { status: 400 });
  }
  const site = await siteGuncelle(id, sonuc.data);
  if (!site) return NextResponse.json({ hata: "Site bulunamadı" }, { status: 404 });
  return NextResponse.json(site);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await kimlik(ctx);
  if (id === null) return NextResponse.json({ hata: "Geçersiz site numarası" }, { status: 400 });
  if (!(await siteSil(id))) return NextResponse.json({ hata: "Site bulunamadı" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
