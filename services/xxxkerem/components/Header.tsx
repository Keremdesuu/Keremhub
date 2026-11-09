"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Clapperboard, Images, Search, Users, House } from "lucide-react";
import Logo from "./Logo";
import ScanButton from "./ScanButton";

const TABS = [
  { href: "/", label: "Videolar", icon: Clapperboard, match: (p: string) => p === "/" || p.startsWith("/watch") },
  { href: "/photos", label: "Fotoğraflar", icon: Images, match: (p: string) => p.startsWith("/photo") },
  { href: "/profiles", label: "Profiller", icon: Users, match: (p: string) => p.startsWith("/profiles") },
];

function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  const base = pathname.startsWith("/photo") ? "/photos" : pathname.startsWith("/profiles") ? "/profiles" : "/";
  const placeholder =
    base === "/photos" ? "Fotoğraf ara" : base === "/profiles" ? "Profil ara" : "Video ara";

  return (
    <form
      className="relative w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `${base}?q=${encodeURIComponent(v)}` : base);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full bg-panel py-2.5 pl-4 pr-12 text-sm text-white placeholder:text-muted outline-none ring-1 ring-transparent focus:ring-brand"
      />
      <button
        type="submit"
        aria-label="Ara"
        className="absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-ink transition-colors hover:bg-white"
      >
        <Search size={18} strokeWidth={2.5} />
      </button>
    </form>
  );
}

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-panel bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <div className="flex min-w-0 flex-1 justify-center">
          <Suspense fallback={<div className="h-10 w-full max-w-xl rounded-full bg-panel" />}>
            <SearchBox />
          </Suspense>
        </div>
        <ScanButton />
        <a href="/" aria-label="Keremhub’a dön" title="Keremhub’a dön" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-white/15 bg-panel px-3 text-sm font-semibold text-white transition-colors hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          <House size={18} aria-hidden="true" />
          <span className="hidden lg:inline">Keremhub</span>
        </a>
      </div>
      <nav className="bg-panel">
        <div className="mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-2 sm:px-5">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 border-b-[3px] px-4 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                  active ? "border-brand text-brand" : "border-transparent text-white hover:text-brand"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
