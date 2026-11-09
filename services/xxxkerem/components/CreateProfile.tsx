"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { BASE } from "@/lib/url";

export default function CreateProfile() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/profiles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Profil oluşturulamadı");
      if (res.status === 200) { setError("Bu isimde bir profil zaten var. Farklı bir isim girin."); return; }
      router.push(`/profiles/${data.id}`);
      router.refresh();
    } catch { setError("Profil oluşturulamadı. Lütfen tekrar deneyin."); }
    finally { setBusy(false); }
  }
  return <div className="mb-5">
    <button type="button" className="btn-primary" aria-expanded={open} aria-controls="create-profile-form" onClick={() => { setOpen(!open); setError(null); }} disabled={busy}>
      <Plus size={16} /> Yeni profil oluştur
    </button>
    {open && <form id="create-profile-form" onSubmit={create} className="mt-3 rounded-lg bg-panel p-4">
      <label htmlFor="new-profile-name" className="mb-2 block text-sm font-semibold">Profil adı</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="new-profile-name" autoFocus required value={name} onChange={e => { setName(e.target.value); setError(null); }} disabled={busy} placeholder="Profil adını yazın" className="input max-w-sm" />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Oluşturuluyor…" : "Oluştur"}</button>
        <button type="button" disabled={busy} className="btn-ghost" onClick={() => { setOpen(false); setName(""); setError(null); }}>Vazgeç</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </form>}
  </div>;
}
