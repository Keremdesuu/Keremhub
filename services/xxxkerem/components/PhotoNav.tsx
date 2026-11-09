"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PhotoNav({ prev, next }: { prev: string | null; next: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (t && (t.closest("dialog") || t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft" && prev) router.push(prev);
      if (e.key === "ArrowRight" && next) router.push(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);
  return null;
}
