"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteShelf } from "@/app/takip/actions";
import { IconTrash } from "./icons";

export default function ShelfDelete({ shelfId, name }: { shelfId: number; name: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`"${name}" rafı silinsin mi? Kitaplar kütüphanede kalır, yalnızca raf kalkar.`)) return;
        start(async () => {
          await deleteShelf(shelfId);
          router.replace("/takip");
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:border-amber hover:text-amber"
    >
      <IconTrash size={16} /> Rafı sil
    </button>
  );
}
