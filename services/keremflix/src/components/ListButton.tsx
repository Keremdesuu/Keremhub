"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon } from "./Icons";
import { withBase } from "@/lib/base";

export function ListButton({ titleId, initial, size = 40, label }: { titleId: number; initial: boolean; size?: number; label?: boolean }) {
  const [inList, setInList] = useState(initial);
  const [, start] = useTransition();
  const router = useRouter();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setInList((v) => !v); // iyimser güncelleme
    const res = await fetch(withBase("/api/list"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titleId }) });
    if (res.ok) {
      const j = (await res.json()) as { inList: boolean };
      setInList(j.inList);
      start(() => router.refresh());
    } else setInList((v) => !v);
  }

  const title = inList ? "Listemden çıkar" : "Listeme ekle";
  if (label) {
    return (
      <button onClick={toggle} className="m-body inline-flex items-center gap-2 rounded-md bg-glass px-5 py-2 transition hover:bg-glass-strong">
        {inList ? <CheckIcon size={22} /> : <PlusIcon size={22} />}
        {inList ? "Listemde" : "Listeme Ekle"}
      </button>
    );
  }
  return (
    <button onClick={toggle} title={title} aria-label={title} className="icon-btn" style={{ width: size, height: size }}>
      {inList ? <CheckIcon size={size * 0.55} /> : <PlusIcon size={size * 0.55} />}
    </button>
  );
}
