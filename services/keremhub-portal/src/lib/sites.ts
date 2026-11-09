import { z } from "zod";

export const IKON_ADLARI = [
  "globe", "film", "tv", "kitap", "kutuphane", "muzik", "foto", "kamera",
  "oyun", "egitim", "indir", "klasor", "disk", "haber", "sunucu", "ev",
] as const;
export type IkonAdi = (typeof IKON_ADLARI)[number];

export const RENKLER = [
  "#0F766E", "#2563EB", "#7C3AED", "#DB2777", "#DC2626",
  "#EA580C", "#CA8A04", "#16A34A", "#0891B2", "#475569",
] as const;

const ADRES = /^(\/\S*|:\d{2,5}(\/\S*)?|https?:\/\/\S+)$/;

const temel = z.object({
  ad: z.string().trim().min(1, "Site adı boş olamaz").max(40, "Site adı en fazla 40 karakter olabilir"),
  aciklama: z.string().trim().max(140, "Açıklama en fazla 140 karakter olabilir"),
  yol: z
    .string()
    .trim()
    .regex(ADRES, "Adres / ile (/kitabevi/), :port ile (:3200) ya da http:// ile başlamalı"),
  ikon: z.enum(IKON_ADLARI),
  renk: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB biçiminde olmalı"),
  aktif: z.boolean(),
});

/** Yeni site: eksik alanlar varsayılanla dolar. */
export const siteSchema = temel.extend({
  aciklama: temel.shape.aciklama.default(""),
  ikon: temel.shape.ikon.default("globe"),
  renk: temel.shape.renk.default("#0F766E"),
  aktif: temel.shape.aktif.default(true),
});

/** Güncelleme: yalnızca gönderilen alanlar değişir, varsayılan uygulanmaz. */
export const siteGuncelle = temel.partial();

export type SiteInput = z.infer<typeof siteSchema>;

export interface SiteDTO {
  id: number;
  ad: string;
  aciklama: string;
  yol: string;
  ikon: string;
  renk: string;
  sira: number;
  aktif: boolean;
}

/** Tarayıcıda tıklanacak adres. ":3200" biçimi, portalın açıldığı IP ile birleşir. */
export function tarayiciAdresi(yol: string, host: string): string {
  if (yol.startsWith(":")) return `http://${host || "localhost"}${yol}`;
  return yol;
}

/** Sunucunun durum kontrolü için denediği adres. */
export function kontrolAdresi(yol: string, base: string): string {
  if (yol.startsWith(":")) return `http://127.0.0.1${yol}`;
  if (yol.startsWith("/")) return `${base.replace(/\/$/, "")}${yol}`;
  return yol;
}

/** Zemin renginin üstünde okunacak yazı rengi. */
export function yaziRengi(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.38 ? "#101A1B" : "#FFFFFF";
}
