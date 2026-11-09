"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// The root remains mounted while /photo/[id] pages change.
export default function PhotoFullscreenBoundary() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.photoFullscreen === "true" && !/(?:^|\/)photo\/\d+\/?$/.test(pathname)) {
      delete root.dataset.photoFullscreen;
      if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
    }
  }, [pathname]);
  useEffect(() => {
    const clear = () => { if (!document.fullscreenElement) delete document.documentElement.dataset.photoFullscreen; };
    document.addEventListener("fullscreenchange", clear);
    return () => document.removeEventListener("fullscreenchange", clear);
  }, []);
  return null;
}
