"use client";

import AvatarEditor from "./AvatarEditor";
import { BASE } from "@/lib/url";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Pencil, Trash2 } from "lucide-react";

export default function ProfileActions({
  id,
  name,
  hidden,
  avatarMediaId,
  hasCustomAvatar,
}: {
  id: number;
  name: string;
  hasCustomAvatar: boolean;
  hidden: boolean;
  avatarMediaId?: number | null;
}) {
  const [cropping, setCropping] = useState(false);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(`${BASE}/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "İşlem başarısız");
      return false;
    }
    router.refresh();
    return true;
  }

  async function remove() {
    if (!confirm(`“${name}” profili silinsin mi? Videolar ve fotoğraflar silinmez, sadece bu profilden ayrılır.`)) return;
    setBusy(true);
    await fetch(`${BASE}/api/profiles/${id}`, { method: "DELETE" });
    router.push("/profiles");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => patch({ hidden: !hidden })} disabled={busy} aria-pressed={hidden} className="btn-ghost">
        {hidden ? "Gizli profil: Açık · Görünür yap" : "Gizli profil: Kapalı · Gizle"}
      </button>
      {avatarMediaId && <button className="btn-ghost" onClick={() => setCropping(true)}>Profil fotoğrafını ayarla</button>}
      {cropping && avatarMediaId && <AvatarEditor profileId={id} mediaId={avatarMediaId} onClose={() => setCropping(false)} />}
      {editing ? (
        <>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && patch({ name: draft }).then((ok) => ok && setEditing(false))}
            autoFocus
            className="input w-56"
          />
          <button
            onClick={async () => (await patch({ name: draft })) && setEditing(false)}
            disabled={busy}
            className="btn-primary"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Kaydet
          </button>
          <button onClick={() => { setEditing(false); setDraft(name); }} className="btn-ghost">
            Vazgeç
          </button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)} className="btn-ghost">
            <Pencil size={15} /> Adı değiştir
          </button>
          {hasCustomAvatar && (
            <button onClick={() => patch({ avatarMediaId: null })} disabled={busy} className="btn-ghost">
              <ImageOff size={15} /> Resmi sıfırla
            </button>
          )}
          <button onClick={remove} disabled={busy} className="btn-danger">
            <Trash2 size={15} /> Sil
          </button>
        </>
      )}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
