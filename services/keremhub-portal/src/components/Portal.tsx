"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { tarayiciAdresi, type SiteDTO } from "@/lib/sites";
import { AppIcon } from "./AppIcon";
import { SiteDialog } from "./SiteDialog";
import { Sistem } from "./Sistem";

export function Portal({ baslangic }: { baslangic: SiteDTO[] }) {
  const [siteler, setSiteler] = useState(baslangic);
  const [durum, setDurum] = useState<Record<number, boolean> | null>(null);
  const [duzenle, setDuzenle] = useState(false);
  const [dialog, setDialog] = useState<{ acik: boolean; site: SiteDTO | null }>({ acik: false, site: null });
  const [silinecek, setSilinecek] = useState<SiteDTO | null>(null);
  const [host, setHost] = useState("");
  const [hata, setHata] = useState("");
  const [bekle, setBekle] = useState(false);
  const [launch, setLaunch] = useState<number | null>(null);
  const silRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { setHost(window.location.hostname); }, []);
  useEffect(() => {
    let alive = true;
    async function getir() {
      if (document.hidden) return;
      try { const r = await fetch("/api/durum", { cache: "no-store", signal: AbortSignal.timeout(8000) }); if (alive) setDurum(r.ok ? await r.json() : null); }
      catch { if (alive) setDurum(null); }
    }
    getir(); const timer = setInterval(getir, 30000);
    document.addEventListener("visibilitychange", getir);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", getir); };
  }, [siteler.length]);
  useEffect(() => {
    const d = silRef.current;
    if (silinecek && d && !d.open) d.showModal();
    if (!silinecek && d?.open) d.close();
  }, [silinecek]);
  const yenile = useCallback(async () => { const r = await fetch("/api/siteler", { cache: "no-store" }); if (!r.ok) throw new Error(); setSiteler(await r.json()); }, []);
  async function tasi(i: number, direction: number) {
    const j = i + direction; if (j < 0 || j >= siteler.length || bekle) return;
    const next = [...siteler]; [next[i], next[j]] = [next[j], next[i]];
    setBekle(true); setHata("");
    try { const r = await fetch("/api/siteler/sirala", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idler: next.map(s => s.id) }) }); if (!r.ok) throw new Error(); setSiteler(next); }
    catch { setHata("Sıralama kaydedilemedi. Tekrar dene."); } finally { setBekle(false); }
  }
  async function sil() {
    if (!silinecek || bekle) return; setBekle(true); setHata("");
    try { const r = await fetch(`/api/siteler/${silinecek.id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); await yenile(); setSilinecek(null); }
    catch { setHata("Site kaldırılamadı. Tekrar dene."); } finally { setBekle(false); }
  }
  const gorunen = duzenle ? siteler : siteler.filter(s => s.aktif);
  const active = siteler.filter(s => s.aktif);
  const online = durum ? active.filter(s => durum[s.id]).length : null;
  return <div className="desktop">
    <div className="wallpaper" aria-hidden="true"/><div className="ambient ambient-one" aria-hidden="true"/><div className="ambient ambient-two" aria-hidden="true"/>
    <div className="desktop-top"><span className="desktop-mark"><span className="brand-symbol">k</span> Kişisel alanın.</span><button className="glass-button" aria-pressed={duzenle} onClick={() => { setDuzenle(!duzenle); setHata(""); }}>{duzenle ? <Check size={15}/> : <Pencil size={14}/>}<span>{duzenle ? "Bitti" : "Düzenle"}</span></button></div>
    <main className="launchpad">
      <header className="launch-heading"><p className="eyebrow">HER ŞEY YERLİ YERİNDE</p><h1>Keremhub<span>.</span></h1><p className="welcome">Küçük bir cihaz. Kocaman bir dünya.</p></header>
      <section aria-label="Uygulamalar" className={`app-shelf ${duzenle ? "editing" : ""}`}>
        <ul className="apps-grid">
          {gorunen.map((s, i) => <li key={s.id} className="app-item" style={{ "--order": i, "--app-color": s.renk } as CSSProperties}>
            <a className={`app-link ${launch === s.id ? "launching" : ""}`} href={tarayiciAdresi(s.yol, host)} onClick={e => { if (duzenle) { e.preventDefault(); setDialog({ acik: true, site: s }); } else { setLaunch(s.id); } }} aria-label={`${s.ad}${duzenle ? " düzenle" : " aç"}`} title={s.aciklama}>
              <span className="icon-stage"><AppIcon site={s}/><span className={`service-dot ${durum === null ? "unknown" : durum[s.id] ? "online" : "offline"}`} title={durum === null ? "Durum bilinmiyor" : durum[s.id] ? "Çevrimiçi" : "Ulaşılamıyor"}/></span>
              <span className="app-label">{s.ad}</span><span className="app-description">{s.aktif ? s.aciklama : "Ana sayfada gizli"}</span>
            </a>
            {duzenle && <div className="edit-tools"><button aria-label={`${s.ad} sola taşı`} disabled={i === 0 || bekle} onClick={() => tasi(i, -1)}><ArrowLeft size={14}/></button><button aria-label={`${s.ad} düzenle`} onClick={() => setDialog({ acik: true, site: s })}><Pencil size={14}/></button><button aria-label={`${s.ad} kaldır`} onClick={() => { setHata(""); setSilinecek(s); }}><Trash2 size={14}/></button><button aria-label={`${s.ad} sağa taşı`} disabled={i === siteler.length - 1 || bekle} onClick={() => tasi(i, 1)}><ArrowRight size={14}/></button></div>}
          </li>)}
          {(duzenle || !gorunen.length) && <li className="app-item"><button className="app-link add-app" onClick={() => setDialog({ acik: true, site: null })}><span className="add-icon"><Plus size={36}/></span><span className="app-label">Site ekle</span><span className="app-description">Alanını genişlet</span></button></li>}
        </ul>
      </section>
      <p className="shelf-caption"><span className={`tiny-dot ${online === active.length && online !== null ? "online" : "unknown"}`}/>{online === null ? "Siteler kontrol ediliyor" : online === active.length ? "Tüm uygulamalar hazır" : `${online} / ${active.length} uygulama çevrimiçi`}<span className="caption-divider"/>Sana ait, sana özel.</p>
      {hata && !silinecek && <p role="alert" className="error-note">{hata}</p>}
    </main>
    <Sistem/>
    <SiteDialog acik={dialog.acik} site={dialog.site} onKapat={() => setDialog({ acik: false, site: null })} onKaydet={async () => { setDialog({ acik: false, site: null }); try { await yenile(); } catch { setHata("Liste yenilenemedi. Sayfayı yeniden aç."); } }}/>
    <dialog ref={silRef} onClose={() => setSilinecek(null)} onClick={e => { if (e.target === silRef.current) setSilinecek(null); }} className="delete-dialog">
      <div className="window-dots" aria-hidden="true"><i/><i/><i/></div><h2>“{silinecek?.ad}” kaldırılsın mı?</h2><p>Yalnızca Keremhub kısayolu kaldırılır. Sitenin dosyaları yerinde kalır.</p>{hata && <p role="alert" className="error-note">{hata}</p>}<div className="dialog-actions"><button className="glass-button" onClick={() => setSilinecek(null)}>Vazgeç</button><button className="danger-button" disabled={bekle} onClick={sil}>{bekle ? "Kaldırılıyor…" : "Kaldır"}</button></div>
    </dialog>
  </div>;
}
