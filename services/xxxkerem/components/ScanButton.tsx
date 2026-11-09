"use client";

import { BASE } from "@/lib/url";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export default function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function scan() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${BASE}/api/scan`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) setMsg(j.error ?? "Tarama başarısız");
      else {
        setMsg(`${j.added} yeni, ${j.removed} kaldırıldı`);
        router.refresh();
      }
    } catch {
      setMsg("Sunucuya ulaşılamadı");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 6000);
    }
  }

  return (
    <div className="relative shrink-0">
      <button onClick={scan} disabled={busy} className="btn-ghost" title="Medya klasörünü tara">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        <span className="hidden sm:inline">{busy ? "Taranıyor…" : "Tara"}</span>
      </button>
      {msg && (
        <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded bg-panel px-3 py-2 text-xs text-white shadow-lg ring-1 ring-brand">
          {msg}
        </div>
      )}
    </div>
  );
}
