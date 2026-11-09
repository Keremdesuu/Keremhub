"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { BASE } from "@/lib/url";

export default function DeleteMediaButton({ id, title, kind, redirect = false }: { id: number; title: string; kind: "photo" | "video"; redirect?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (busy || !window.confirm(`“${title}” kalıcı olarak silinsin mi?\n\nDosya HDD’den ve tüm profillerden tamamen silinecek. Bu işlem geri alınamaz.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/media/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? "Silme başarısız"); }
      if (redirect) router.replace(kind === "photo" ? "/photos" : "/");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Silme başarısız"); }
    finally { setBusy(false); }
  }
  return <div className="mt-2"><button type="button" className="btn-danger" disabled={busy} onClick={remove} aria-label={`${title} dosyasını sil`}>
    {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} {busy ? "Siliniyor…" : "Sil"}
  </button>{error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}</div>;
}
