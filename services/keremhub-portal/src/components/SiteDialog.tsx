"use client";

import { useEffect, useRef, useState } from "react";
import { IKONLAR, Ikon } from "@/lib/icons";
import { IKON_ADLARI, RENKLER, type SiteDTO } from "@/lib/sites";

interface Props {
  acik: boolean;
  site: SiteDTO | null; // null = yeni site
  onKapat: () => void;
  onKaydet: (site: SiteDTO) => void;
}

const bos = { ad: "", aciklama: "", yol: "", ikon: "globe", renk: RENKLER[0] as string, aktif: true };

export function SiteDialog({ acik, site, onKapat, onKaydet }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState(bos);
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (acik && !d.open) {
      setF(site ? { ad: site.ad, aciklama: site.aciklama, yol: site.yol, ikon: site.ikon, renk: site.renk, aktif: site.aktif } : bos);
      setHata("");
      d.showModal();
    }
    if (!acik && d.open) d.close();
  }, [acik, site]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBekle(true);
    setHata("");
    try {
      const res = await fetch(site ? `/api/siteler/${site.id}` : "/api/siteler", {
        method: site ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const veri = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHata(veri.hata ?? "Kaydedilemedi, tekrar dene");
        return;
      }
      onKaydet(veri);
    } catch {
      setHata("Sunucuya ulaşılamadı, bağlantıyı kontrol et");
    } finally {
      setBekle(false);
    }
  }

  const alan = "mt-1.5 w-full rounded-lg border border-cizgi bg-zemin px-3.5 py-2.5 text-base outline-none focus:border-murekkep";

  return (
    <dialog
      ref={ref}
      onClose={onKapat}
      onClick={(e) => e.target === ref.current && onKapat()}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-cizgi bg-yuzey p-0 shadow-2xl"
    >
      <form onSubmit={gonder} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-y-auto p-6 sm:p-8">
        <h2 className="baslik-yazi text-3xl">{site ? "Siteyi düzenle" : "Yeni site ekle"}</h2>

        <label className="block text-sm font-medium">
          Site adı
          <input className={alan} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} placeholder="Kerem Kitabevi" required maxLength={40} autoFocus />
        </label>

        <label className="block text-sm font-medium">
          Kısa açıklama
          <input className={alan} value={f.aciklama} onChange={(e) => setF({ ...f, aciklama: e.target.value })} placeholder="E-kitap arşivi" maxLength={140} />
        </label>

        <label className="block text-sm font-medium">
          Adres
          <input className={alan} value={f.yol} onChange={(e) => setF({ ...f, yol: e.target.value })} placeholder="/kitabevi/" required spellCheck={false} />
          <span className="mt-1.5 block text-sm font-normal text-ikincil">
            <b className="font-medium">/kitabevi/</b> aynı IP üzerindeki yolu, <b className="font-medium">:3200</b> aynı IP&apos;deki portu açar. Başka bir cihaz için <b className="font-medium">http://</b> ile tam adres yaz.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-medium">Simge</legend>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {IKON_ADLARI.map((ad) => (
              <button
                key={ad}
                type="button"
                title={IKONLAR[ad].etiket}
                aria-label={IKONLAR[ad].etiket}
                aria-pressed={f.ikon === ad}
                onClick={() => setF({ ...f, ikon: ad })}
                className="grid aspect-square place-items-center rounded-lg border border-cizgi hover:border-murekkep aria-pressed:border-murekkep aria-pressed:bg-murekkep aria-pressed:text-zemin"
              >
                <Ikon ad={ad} size={18} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Renk</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {RENKLER.map((r) => (
              <button
                key={r}
                type="button"
                aria-label={`Renk ${r}`}
                aria-pressed={f.renk.toLowerCase() === r.toLowerCase()}
                onClick={() => setF({ ...f, renk: r })}
                className="size-8 rounded-full ring-offset-2 ring-offset-yuzey aria-pressed:ring-2 aria-pressed:ring-murekkep"
                style={{ background: r }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-sm text-ikincil">
              <input type="color" value={f.renk} onChange={(e) => setF({ ...f, renk: e.target.value })} className="size-8 cursor-pointer rounded border border-cizgi bg-transparent p-0.5" />
              Başka renk
            </label>
          </div>
        </fieldset>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} className="size-4 accent-[var(--murekkep)]" />
          Ana sayfada göster
        </label>

        {hata && (
          <p role="alert" className="rounded-lg border border-[#b4533a] bg-[#b4533a]/10 px-3.5 py-2.5 text-sm">
            {hata}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onKapat} className="rounded-full px-5 py-2.5 text-base font-medium hover:bg-cizgi/60">
            Vazgeç
          </button>
          <button type="submit" disabled={bekle} className="rounded-full bg-murekkep px-6 py-2.5 text-base font-semibold text-zemin hover:opacity-90 disabled:opacity-60">
            {bekle ? "Kaydediliyor" : site ? "Değişiklikleri kaydet" : "Siteyi ekle"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
