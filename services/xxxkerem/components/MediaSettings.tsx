"use client";

import { BASE } from "@/lib/url";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Pencil, Settings2, UserPlus, X } from "lucide-react";
import DeleteMediaButton from "./DeleteMediaButton";
import AvatarEditor from "./AvatarEditor";
import Avatar from "./Avatar";
import ProfilePicker from "./ProfilePicker";

type P = { id: number; name: string; avatarMediaId: number | null };

export default function MediaSettings({
  mediaId,
  title,
  profiles,
  kind,
}: {
  mediaId: number;
  title: string;
  profiles: P[];
  kind: "video" | "photo";
}) {
  const [cropProfile, setCropProfile] = useState<number | null>(null);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => setDraft(title), [title]);

  async function patch(url: string, body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setNote(j.error ?? "İşlem başarısız");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    if (!draft.trim()) return;
    if (await patch(`${BASE}/api/media/${mediaId}`, { title: draft.trim() })) setEditing(false);
  }

  return (
    <section className="mt-4 rounded-lg bg-panel p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand">
        <Settings2 size={15} /> Profil ve isim ayarları
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveTitle();
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(title);
                }
              }}
              autoFocus
              className="input max-w-xl flex-1 text-lg font-bold"
            />
            <button onClick={saveTitle} disabled={busy} className="btn-primary" aria-label="Başlığı kaydet">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Kaydet
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft(title);
              }}
              className="btn-ghost"
            >
              Vazgeç
            </button>
          </>
        ) : (
          <>
            <h1 className="min-w-0 break-words text-xl font-extrabold leading-snug">{title}</h1>
            <button onClick={() => setEditing(true)} className="btn-ghost !px-2.5 !py-1.5" title="İsmi düzenle">
              <Pencil size={14} /> <span className="text-xs">İsmi düzenle</span>
            </button>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {profiles.length === 0 && <span className="text-sm italic text-muted">Bu {kind === "video" ? "videoya" : "fotoğrafa"} henüz profil atanmadı.</span>}
        {profiles.map((p) => (
          <span key={p.id} className="flex items-center gap-2 rounded-full bg-ink py-1 pl-1 pr-1.5 ring-1 ring-[#3a3a3a]">
            <Avatar name={p.name} mediaId={p.avatarMediaId} size={28} />
            <Link href={`/profiles/${p.id}`} className="text-sm font-semibold hover:text-brand">
              {p.name}
            </Link>
            <button
              onClick={async () => {
                setCropProfile(p.id);
              }}
              disabled={busy}
              title="Bunu profil resmi yap"
              hidden={kind !== "photo"}
              className="rounded-full p-1 text-muted hover:bg-panel hover:text-brand"
            >
              <Camera size={14} />
            </button>
            <button
              onClick={() => patch(`${BASE}/api/media/${mediaId}`, { profileIds: profiles.filter((x) => x.id !== p.id).map((x) => x.id) })}
              disabled={busy}
              title="Profilden çıkar"
              className="rounded-full p-1 text-muted hover:bg-panel hover:text-red-400"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <button onClick={() => setPicker(true)} className="btn-primary">
          <UserPlus size={16} /> Profili düzenle
        </button>
      </div>

      <DeleteMediaButton id={mediaId} title={title} kind={kind} redirect />

      {note && <p className="mt-3 text-xs text-muted">{note}</p>}

      {cropProfile && <AvatarEditor profileId={cropProfile} mediaId={mediaId} onClose={() => setCropProfile(null)} />}
      {picker && (
        <ProfilePicker
          mediaId={mediaId}
          initialSelected={profiles.map((p) => p.id)}
          onClose={() => setPicker(false)}
          onSaved={() => {
            setPicker(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
