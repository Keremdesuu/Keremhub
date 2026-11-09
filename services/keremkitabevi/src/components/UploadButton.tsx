"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremkitabevi";
type Entry = { name: string; state: "waiting" | "uploading" | "done" | "error"; progress: number; message?: string };
export default function UploadButton() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  function update(index: number, changes: Partial<Entry>) { setEntries(all => all.map((row, i) => i === index ? { ...row, ...changes } : row)); }
  function send(file: File, index: number): Promise<void> {
    return new Promise(resolve => {
      if (!/\.(epub|kepub|pdf)$/i.test(file.name) || !file.size || file.size > 50 * 1024 * 1024) { update(index, { state: "error", message: "EPUB, KEPUB veya PDF seç; dosya en fazla 50 MB olabilir." }); resolve(); return; }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/api/upload`);
      xhr.timeout = 10 * 60 * 1000;
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      update(index, { state: "uploading", progress: 0 });
      xhr.upload.onprogress = e => { if (e.lengthComputable) update(index, { progress: Math.round(e.loaded / e.total * 100) }); };
      xhr.onload = () => {
        let result: { name?: string; warning?: string; error?: string } = {};
        try { result = JSON.parse(xhr.responseText); } catch {}
        update(index, xhr.status === 201 ? { state: "done", progress: 100, message: result.warning || `${result.name || file.name} kütüphaneye eklendi.` } : { state: "error", message: result.error || (xhr.status === 413 ? "Dosya en fazla 50 MB olabilir." : "Yükleme tamamlanamadı. Tekrar dene.") });
        resolve();
      };
      xhr.onerror = () => { update(index, { state: "error", message: "Bağlantı kesildi. Yeniden denemeden önce kütüphaneyi kontrol et." }); resolve(); };
      xhr.ontimeout = () => { update(index, { state: "error", message: "İşlem zaman aşımına uğradı. Yeniden denemeden önce kütüphaneyi kontrol et." }); resolve(); };
      xhr.send(file);
    });
  }
  async function upload(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files);
    setEntries(selected.map(f => ({ name: f.name, state: "waiting", progress: 0 })));
    setBusy(true);
    try { for (let i = 0; i < selected.length; i++) await send(selected[i], i); }
    finally { setBusy(false); if (input.current) input.current.value = ""; router.refresh(); }
  }
  return <div className="w-full sm:w-auto">
    <input ref={input} type="file" multiple accept=".epub,.kepub,.pdf,application/epub+zip,application/pdf" className="sr-only" aria-label="Yüklenecek kitap dosyalarını seç" tabIndex={-1} onChange={e => upload(e.target.files)}/>
    <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:border-signal hover:text-signal-soft disabled:opacity-60">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>
      {busy ? "Yükleniyor…" : "Kitap yükle"}
    </button>
    {!!entries.length && <section aria-label="Kitap yükleme durumu" className="mt-3 max-h-64 max-w-md overflow-auto rounded-lg border border-line bg-surface p-3 text-sm shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-3"><strong className="font-medium">{busy ? "Kitaplar HDD’ye aktarılıyor" : "Yükleme sonuçları"}</strong>{!busy && <button type="button" aria-label="Yükleme sonuçlarını kapat" className="px-1 text-muted hover:text-fg" onClick={() => setEntries([])}>×</button>}</div>
      <ul className="space-y-3">{entries.map((row, i) => <li key={i}>
        <p className="break-all text-fg">{row.name}</p>
        {row.state === "uploading" && <><progress className="mt-1 h-1.5 w-full accent-signal" value={row.progress} max={100} aria-label={`${row.name} yükleme ilerlemesi`}/><p className="text-xs text-muted">{row.progress === 100 ? "HDD’ye kaydediliyor ve kütüphaneye ekleniyor…" : `%${row.progress} yüklendi`}</p></>}
        {row.state === "waiting" && <p className="text-xs text-muted">Sırada</p>}
        {row.message && <p role={row.state === "error" ? "alert" : "status"} className={`mt-1 text-xs ${row.state === "error" ? "text-red-300" : "text-signal-soft"}`}>{row.message}</p>}
      </li>)}</ul>
      <p className="mt-3 text-xs text-muted">EPUB · KEPUB · PDF · Dosya başına en fazla 50 MB</p>
    </section>}
  </div>;
}
