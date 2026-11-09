"use client";

import { BASE } from "@/lib/url";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import Avatar from "./Avatar";

type P = { id: number; name: string; avatarMediaId: number | null };

export default function ProfilePicker({
  mediaId,
  initialSelected,
  onClose,
  onSaved,
}: {
  mediaId: number;
  initialSelected: number[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [profiles, setProfiles] = useState<P[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(`${BASE}/api/profiles`)
      .then((r) => r.json())
      .then(setProfiles)
      .catch(() => setError("Profiller yüklenemedi"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const norm = (s: string) => s.toLocaleLowerCase("tr").trim();
  const query = norm(q);

  const filtered = useMemo(
    () => (profiles ?? []).filter((p) => !query || norm(p.name).includes(query)),
    [profiles, query],
  );
  const exact = (profiles ?? []).find((p) => norm(p.name) === query);

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function createProfile() {
    const name = q.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const p = (await res.json()) as P;
      if (!res.ok) throw new Error();
      setProfiles((list) => (list && list.some((x) => x.id === p.id) ? list : [...(list ?? []), p]));
      setSelected((s) => new Set(s).add(p.id));
      setQ("");
    } catch {
      setError("Profil oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Kaydedilemedi");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-xl bg-panel shadow-2xl ring-1 ring-[#3a3a3a] sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-[#3a3a3a] px-5 py-4">
          <h2 className="text-base font-extrabold">Profili düzenle</h2>
          <button onClick={onClose} aria-label="Kapat" className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (exact) toggle(exact.id);
                else if (q.trim()) void createProfile();
              }}
              placeholder="Profil ara veya yeni isim yaz"
              className="input pl-9"
            />
          </div>
        </div>

        <div className="mt-3 min-h-[8rem] flex-1 overflow-y-auto px-3 pb-2">
          {q.trim() && !exact && (
            <button
              onClick={createProfile}
              disabled={creating}
              className="mb-1 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-brand hover:bg-ink"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-ink">
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              </span>
              <span className="text-sm font-semibold">“{q.trim()}” adında yeni profil oluştur</span>
            </button>
          )}

          {profiles === null && !error && (
            <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted">
              <Loader2 size={16} className="animate-spin" /> Yükleniyor…
            </p>
          )}
          {profiles && filtered.length === 0 && !q.trim() && (
            <p className="px-2 py-6 text-sm text-muted">Henüz profil yok. Yukarıya bir isim yazıp oluşturabilirsin.</p>
          )}

          {filtered.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-ink ${on ? "bg-ink" : ""}`}
              >
                <Avatar name={p.name} mediaId={p.avatarMediaId} size={36} />
                <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded border-2 ${on ? "border-brand bg-brand text-ink" : "border-[#555]"}`}
                >
                  {on && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="px-5 pb-1 text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-[#3a3a3a] px-5 py-4">
          <span className="text-xs text-muted">{selected.size} profil seçili</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost">
              Vazgeç
            </button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
