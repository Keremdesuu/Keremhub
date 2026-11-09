import { db } from "./db";
import type { SiteDTO, SiteInput } from "./sites";

const sirali = [{ sira: "asc" as const }, { id: "asc" as const }];

export async function siteleriListele(): Promise<SiteDTO[]> {
  return db.site.findMany({
    orderBy: sirali,
    select: { id: true, ad: true, aciklama: true, yol: true, ikon: true, renk: true, sira: true, aktif: true },
  });
}

export async function siteEkle(veri: SiteInput): Promise<SiteDTO> {
  const son = await db.site.aggregate({ _max: { sira: true } });
  return db.site.create({
    data: { ...veri, sira: (son._max.sira ?? -1) + 1 },
    select: { id: true, ad: true, aciklama: true, yol: true, ikon: true, renk: true, sira: true, aktif: true },
  });
}

export async function siteGuncelle(id: number, veri: Partial<SiteInput>): Promise<SiteDTO | null> {
  const var_mi = await db.site.findUnique({ where: { id }, select: { id: true } });
  if (!var_mi) return null;
  return db.site.update({
    where: { id },
    data: veri,
    select: { id: true, ad: true, aciklama: true, yol: true, ikon: true, renk: true, sira: true, aktif: true },
  });
}

export async function siteSil(id: number): Promise<boolean> {
  const var_mi = await db.site.findUnique({ where: { id }, select: { id: true } });
  if (!var_mi) return false;
  await db.site.delete({ where: { id } });
  return true;
}

export async function siraKaydet(idler: number[]): Promise<void> {
  await db.$transaction(idler.map((id, sira) => db.site.update({ where: { id }, data: { sira } })));
}
