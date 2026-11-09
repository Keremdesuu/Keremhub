"use client";

import { BASE } from "@/lib/url";
import { useEffect, useRef } from "react";

export default function ViewCounter({ id }: { id: number }) {
  const done = useRef<number | null>(null);
  useEffect(() => {
    if (done.current === id) return;
    done.current = id;
    fetch(`${BASE}/api/media/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id]);
  return null;
}
