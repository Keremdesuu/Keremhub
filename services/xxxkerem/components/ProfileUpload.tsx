"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import AvatarEditor from "./AvatarEditor";
import { BASE } from "@/lib/url";

export default function ProfileUpload({ id, avatar = false }: { id: number; avatar?: boolean }) {
  const [cropFile, setCropFile] = useState<File | null>(null);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function upload(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    setNote(null);
    let added = 0;
    let failed = 0;
    let videos = 0;
    for (let i = 0; i < list.length; i++) {
      setProgress(`${i + 1}/${list.length}`);
      try {
        const fd = new FormData();
        fd.append("files", list[i]!);
        if (avatar) fd.append("avatar", "true");
        const res = await fetch(`${BASE}/api/profiles/${id}/upload`, { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          added += j.added ?? 0;
          videos += j.videos ?? 0;
          failed += j.skipped ?? 0;
        } else failed++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setProgress("");
    setNote(`${added} dosya eklendi${failed ? `, ${failed} dosya eklenemedi` : ""}`);
    if (input.current) input.current.value = "";
    if (added > 0 && !avatar) router.push(`/profiles/${id}${videos ? "" : "?tab=photos"}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={input}
        type="file"
        accept={avatar ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,.mkv,.avi,.m4v"}
        multiple={!avatar}
        hidden
        onChange={(e) => { if (avatar) { const f=e.target.files?.[0]; if(f) { setCropFile(f); e.target.value=""; } } else if(e.target.files) void upload(e.target.files); }}
      />
      <button onClick={() => input.current?.click()} disabled={busy} className="btn-primary">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {busy ? `Yükleniyor ${progress}` : avatar ? "Profil fotoğrafı yükle" : "Fotoğraf / video ekle"}
      </button>
      {cropFile && <AvatarEditor profileId={id} file={cropFile} onClose={() => setCropFile(null)} />}
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
