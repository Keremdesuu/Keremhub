import {
  BookOpen, Camera, Download, Film, FolderOpen, Gamepad2, Globe, GraduationCap,
  HardDrive, House, Image as Foto, Library, Music, Newspaper, Server, Tv,
  type LucideIcon,
} from "lucide-react";
import type { IkonAdi } from "./sites";

export const IKONLAR: Record<IkonAdi, { icon: LucideIcon; etiket: string }> = {
  globe: { icon: Globe, etiket: "Genel" },
  film: { icon: Film, etiket: "Film" },
  tv: { icon: Tv, etiket: "Dizi" },
  kitap: { icon: BookOpen, etiket: "Kitap" },
  kutuphane: { icon: Library, etiket: "Kütüphane" },
  muzik: { icon: Music, etiket: "Müzik" },
  foto: { icon: Foto, etiket: "Fotoğraf" },
  kamera: { icon: Camera, etiket: "Kamera" },
  oyun: { icon: Gamepad2, etiket: "Oyun" },
  egitim: { icon: GraduationCap, etiket: "Eğitim" },
  indir: { icon: Download, etiket: "İndirme" },
  klasor: { icon: FolderOpen, etiket: "Dosyalar" },
  disk: { icon: HardDrive, etiket: "Disk" },
  haber: { icon: Newspaper, etiket: "Haber" },
  sunucu: { icon: Server, etiket: "Sunucu" },
  ev: { icon: House, etiket: "Ev" },
};

export function Ikon({ ad, size = 22 }: { ad: string; size?: number }) {
  const I = (IKONLAR as Record<string, { icon: LucideIcon }>)[ad]?.icon ?? Globe;
  return <I size={size} strokeWidth={1.75} aria-hidden />;
}
