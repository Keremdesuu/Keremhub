"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, ChevronUp, Cpu, HardDrive, MemoryStick, Thermometer, X, Wifi, Clock3 } from "lucide-react";

interface SistemBilgi {
  sicaklik: number | null; yuk: number; islemciKullanim: number | null; cekirdek: number;
  bellekToplam: number; bellekBos: number; calismaSuresi: number; model: string;
  diskler: { ad: string; toplam: number; bos: number }[];
}
type Panel = "genel" | "bellek" | "disk";
const gb = (n: number) => `${(n / 1024 ** 3).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
const percent = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
function duration(n: number) { const d = Math.floor(n / 86400), h = Math.floor(n % 86400 / 3600), m = Math.floor(n % 3600 / 60); return d ? `${d} gün ${h} saat` : h ? `${h} saat ${m} dk` : `${m} dakika`; }
function Meter({ name, value, detail, ratio, warn }: { name: string; value: string; detail: string; ratio?: number; warn?: boolean }) {
  return <div className={`metric ${warn ? "metric-warn" : ""}`}><span className="metric-label">{name}</span><strong>{value}</strong><span className="metric-detail">{detail}</span>{ratio !== undefined && <div className="meter" role="meter" aria-label={name} aria-valuenow={percent(ratio)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent(ratio)}%` }}/></div>}</div>;
}
export function Sistem() {
  const [b, setB] = useState<SistemBilgi | null>(null);
  const [stale, setStale] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let alive = true, busy = false;
    async function refresh() {
      if (document.hidden || busy) return; busy = true;
      try { const r = await fetch("/api/sistem", { cache: "no-store", signal: AbortSignal.timeout(7000) }); if (!r.ok) throw new Error(); const data = await r.json(); if (alive) { setB(data); setStale(false); setUpdated(new Date()); } }
      catch { if (alive) setStale(true); } finally { busy = false; }
    }
    refresh(); setNow(new Date()); const timer = setInterval(refresh, 10000); const clock = setInterval(() => setNow(new Date()), 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; clearInterval(timer); clearInterval(clock); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => {
    if (!panel) return;
    function outside(e: PointerEvent) { if (!root.current?.contains(e.target as Node)) setPanel(null); }
    function key(e: KeyboardEvent) { if (e.key === "Escape") { setPanel(null); trigger.current?.focus(); } }
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [panel]);
  function toggle(next: Panel, button: HTMLButtonElement) { trigger.current = button; setPanel(panel === next ? null : next); }
  const used = b ? b.bellekToplam - b.bellekBos : 0;
  const ram = b ? percent(used / b.bellekToplam * 100) : 0;
  const temp = b?.sicaklik != null ? `${b.sicaklik.toLocaleString("tr-TR")}°` : "—";
  return <div className="system-root" ref={root}>
    {panel && <section ref={pane} className="system-panel glass" id="system-panel" aria-label="Raspberry Pi sistem bilgileri">
      <div className="panel-heading"><div><div className="window-dots" aria-hidden="true"><i/><i/><i/></div><h2>Raspberry Pi <span>5</span></h2><p>{b?.model || "Kişisel sunucun"}</p></div><button className="icon-button" aria-label="Sistem panelini kapat" onClick={() => { setPanel(null); trigger.current?.focus(); }}><X size={18}/></button></div>
      <div className="panel-tabs" aria-label="Sistem görünümü">{([['genel','Genel bakış'],['bellek','Bellek'],['disk','Depolama']] as const).map(([key,label]) => <button key={key} aria-pressed={panel === key} onClick={() => setPanel(key)}>{label}</button>)}</div>
      {!b ? <p className="panel-empty" role="status">{stale ? "Cihaza ulaşılamıyor. Bağlantı otomatik yeniden denenecek." : "Cihaz bilgileri alınıyor…"}</p> : <>
        <div className="metric-grid">
          {panel === "genel" && <>
            <Meter name="İşlemci sıcaklığı" value={`${temp}${b.sicaklik === null ? "" : "C"}`} detail={b.sicaklik === null ? "Sensör okunamıyor" : b.sicaklik >= 80 ? "Sıcaklık yüksek" : b.sicaklik >= 70 ? "Cihaz ısınıyor" : "Normal aralıkta"} ratio={b.sicaklik === null ? undefined : b.sicaklik / 85 * 100} warn={b.sicaklik !== null && b.sicaklik >= 70}/>
            <Meter name="İşlemci kullanımı" value={b.islemciKullanim === null ? "Ölçülüyor" : `%${percent(b.islemciKullanim)}`} detail={`${b.cekirdek} çekirdek · 1 dk yük: ${b.yuk.toFixed(2)}`} ratio={b.islemciKullanim ?? undefined}/>
            <Meter name="Bellek kullanımı" value={`%${ram}`} detail={`${gb(used)} / ${gb(b.bellekToplam)}`} ratio={ram} warn={ram > 90}/>
            <Meter name="Kesintisiz çalışma" value={duration(b.calismaSuresi)} detail="Son açılıştan bu yana"/>
          </>}
          {panel === "bellek" && <><Meter name="Kullanılan bellek" value={gb(used)} detail={`Toplam belleğin %${ram} kadarı`} ratio={ram} warn={ram > 90}/><Meter name="Kullanılabilir bellek" value={gb(b.bellekBos)} detail={`Toplam ${gb(b.bellekToplam)}`} ratio={100 - ram}/><p className="metric-note">Kullanılabilir bellek, gerektiğinde uygulamalara ayrılabilen önbelleği de içerir.</p></>}
          {panel === "disk" && (b.diskler.length ? b.diskler.map(d => <Meter key={d.ad} name={d.ad} value={`${gb(d.bos)} boş`} detail={`${gb(d.toplam - d.bos)} kullanılan / ${gb(d.toplam)} toplam`} ratio={(d.toplam - d.bos) / d.toplam * 100} warn={d.bos / d.toplam < .1}/>) : <p className="metric-note">Depolama bilgisi şu anda okunamıyor.</p>)}
        </div>
        <div className={`panel-footer ${stale ? "stale" : ""}`} role="status"><span className={`tiny-dot ${stale ? "offline" : "online"}`}/>{stale ? "Bağlantı kesildi · Son ölçümler gösteriliyor" : "Canlı · 10 saniyede bir güncellenir"}<span>{updated?.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span></div>
      </>}
    </section>}
    <footer className="system-bar glass" aria-label="Alt sistem çubuğu">
      <button className="device-button" aria-label="Raspberry Pi sistem bilgilerini aç" aria-expanded={panel === "genel"} aria-controls="system-panel" onClick={e => toggle("genel", e.currentTarget)}><span className="device-icon"><Cpu size={18}/></span><span>Raspberry Pi <b>5</b></span><span className={`tiny-dot ${stale ? "offline" : b ? "online" : "unknown"}`}/></button>
      <span className="bar-divider"/>
      <div className="bar-metrics"><button className="status-button" aria-label="Sıcaklık ve işlemci bilgileri" aria-expanded={panel === "genel"} aria-controls="system-panel" onClick={e => toggle("genel", e.currentTarget)}><Thermometer size={16}/><span>{temp}</span></button><button className="status-button" aria-label="Bellek bilgileri" aria-expanded={panel === "bellek"} aria-controls="system-panel" onClick={e => toggle("bellek", e.currentTarget)}><MemoryStick size={17}/><span>{b ? `%${ram}` : "—"}<small> RAM</small></span></button><button className="status-button disk-trigger" aria-label="Depolama bilgileri" aria-expanded={panel === "disk"} aria-controls="system-panel" onClick={e => toggle("disk", e.currentTarget)}><HardDrive size={17}/><span>Depolama</span></button></div>
      <div className="bar-right"><span className="local-network" title="Ev ağındaki kişisel sunucu"><Wifi size={16}/><span>Yerel ağ</span></span><span className="bar-divider"/><time dateTime={now?.toISOString()} suppressHydrationWarning><span className="bar-date">{now?.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span><span>{now?.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) || "—:—"}</span></time><button className={`icon-button control-button ${panel ? "selected" : ""}`} aria-label="Sistem bilgilerini aç" aria-expanded={panel !== null} aria-controls="system-panel" onClick={e => toggle("genel", e.currentTarget)}><Activity size={18}/><ChevronUp size={12}/></button></div>
    </footer>
  </div>;
}
