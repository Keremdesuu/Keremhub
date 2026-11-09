"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconScan } from "./icons";

type Result = { added: number; updated: number; removed: number; unchanged: number; errors: { file: string; message: string }[]; error?: string };

export default function ScanButton({ variant = "ghost" }: { variant?: "ghost" | "solid" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremkitabevi"}/api/scan`, { method: "POST" });
      const r = (await res.json()) as Result;
      if (!res.ok) setMsg(r.error ?? "Tarama başarısız");
      else {
        setMsg(`${r.added} yeni, ${r.updated} güncellendi, ${r.removed} silindi${r.errors.length ? `, ${r.errors.length} dosyada sorun var` : ""}`);
        router.refresh();
      }
    } catch {
      setMsg("Sunucuya ulaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "solid"
      ? "bg-signal text-ink hover:bg-signal-soft"
      : "border border-line text-fg hover:border-signal hover:text-signal-soft";

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${cls}`}
      >
        <IconScan size={18} className={busy ? "animate-pulse" : ""} />
        {busy ? "Taranıyor…" : "Kütüphaneyi tara"}
      </button>
      {msg && (
        <span role="status" className="text-sm text-muted">
          {msg}
        </span>
      )}
    </div>
  );
}
