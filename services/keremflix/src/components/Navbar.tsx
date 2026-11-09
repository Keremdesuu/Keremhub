"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BellIcon, CloseIcon, SearchIcon, UserIcon } from "./Icons";
import { withBase } from "@/lib/base";

const links = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/dizi", label: "Diziler" },
  { href: "/film", label: "Filmler" },
  { href: "/anime", label: "Animeler" },
  { href: "/listem", label: "Listem" },
];

export function Navbar({ portalUrl }: { portalUrl?: string }) {
  const path = usePathname();
  const router = useRouter();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  if (path.startsWith("/watch")) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/arama?q=${encodeURIComponent(q.trim())}`);
  }

  async function rescan() {
    setScanning("Taranıyor…");
    try {
      const res = await fetch(withBase("/api/scan?refetch=1"), { method: "POST" });
      const j = await res.json();
      setScanning(res.ok ? `${j.titles} başlık, ${j.metaFetched} bilgi tamamlandı${j.metaMissing ? ` · ${j.metaMissing} eksik` : ""}` : (j.error ?? "Hata"));
      router.refresh();
    } catch {
      setScanning("Tarama başarısız");
    }
    setTimeout(() => setScanning(null), 4000);
  }

  return (
    <header className={`fixed inset-x-0 top-0 z-50 bg-ink-800/95 backdrop-blur-md transition-colors duration-300 lg:bg-transparent ${solid ? "lg:bg-ink-800/85" : "lg:bg-gradient-to-b lg:from-black/80 lg:to-transparent"}`}>
      <nav className="flex h-14 items-center gap-3 px-[4vw] lg:h-16 lg:gap-8">
        <Link href="/" className={`logo shrink-0 text-[28px] lg:text-[34px] ${open ? "hidden sm:block" : ""}`} aria-label="Keremflix">KEREMFLIX</Link>
        <ul aria-label="Kategoriler" className="hidden items-center gap-5 lg:flex">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={active ? "page" : undefined} className={`r-smallbody transition hover:text-gray-200 ${active ? "m-smallbody text-white" : "text-gray-100/80"}`}>{l.label}</Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex min-w-0 items-center gap-2 lg:gap-4">
          <form onSubmit={submit} className={`flex items-center overflow-hidden rounded-md border transition-all duration-200 ${open ? "w-[min(16rem,60vw)] border-white/70 bg-black/70 lg:w-56" : "w-8 border-transparent"}`}>
            <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Ara" className="grid h-8 w-8 flex-none place-items-center"><SearchIcon size={22} /></button>
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık ara" className="r-smallbody w-full bg-transparent pr-2 outline-none placeholder:text-gray-300" />
            {open && q && (
              <button type="button" onClick={() => setQ("")} aria-label="Temizle" className="mr-1 flex-none"><CloseIcon size={16} /></button>
            )}
          </form>
          <button onClick={rescan} title="Kütüphaneyi yeniden tara" aria-label="Kütüphaneyi yeniden tara" disabled={Boolean(scanning)} className="grid size-9 shrink-0 place-items-center disabled:opacity-50"><BellIcon size={22} /></button>
          {scanning && <span className="r-caption1 absolute right-[4vw] top-14 rounded bg-ink-600 px-3 py-1">{scanning}</span>}
          {portalUrl && (
            <a href={portalUrl} className="m-caption1 hidden rounded-md bg-glass px-3 py-1.5 transition hover:bg-glass-strong sm:block">Keremhub</a>
          )}
          <span className="hidden h-8 w-8 sm:grid place-items-center rounded bg-brand" aria-hidden><UserIcon size={20} /></span>
        </div>
      </nav>
      <nav aria-label="Mobil kategoriler" className="overflow-x-auto border-t border-white/10 px-[4vw] lg:hidden">
        <ul className="flex h-12 min-w-max items-center gap-5 whitespace-nowrap">
          {links.map(link=>{const active=link.href==="/"?path==="/":path.startsWith(link.href);return <li key={link.href}><Link href={link.href} aria-current={active?"page":undefined} className={`inline-flex h-12 items-center border-b-2 text-sm ${active?"border-brand font-semibold text-white":"border-transparent text-gray-100/80"}`}>{link.label}</Link></li>;})}
        </ul>
      </nav>
    </header>
  );
}
