import Link from "next/link";
import { IconHome, IconHub, IconLibrary, IconSearch, IconTrack, LogoMark } from "./icons";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremkitabevi").replace(/\/$/, "");

export default function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark size={34} />
          <span className="hidden text-lg sm:block">Kerem Kitabevi</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1 text-sm">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-fg">
            <IconHome size={18} />
            <span className="hidden md:inline">Ana sayfa</span>
          </Link>
          <Link href="/kutuphane" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-fg">
            <IconLibrary size={18} />
            <span className="hidden md:inline">Kütüphane</span>
          </Link>
          <Link href="/kobo" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-fg"><span className="hidden md:inline">Kobo</span></Link>
          <Link href="/takip" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-fg">
            <IconTrack size={18} />
            <span className="hidden md:inline">Takip</span>
          </Link>
        </nav>

        <form action={`${basePath}/kutuphane`} className="ml-auto flex min-w-0 flex-1 justify-end" role="search">
          <label className="relative w-full max-w-sm">
            <span className="sr-only">Kitap, yazar veya seri ara</span>
            <IconSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              placeholder="Kitap, yazar veya seri ara"
              className="w-full rounded-lg border border-line bg-surface py-2 pl-10 pr-3 text-sm placeholder:text-muted/80 focus:border-signal focus:outline-none"
            />
          </label>
        </form>

        {/* Keremhub ana portalı basePath dışında, kökte */}
        <a
          href="/"
          title="Keremhub'a dön"
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:border-signal hover:text-fg"
        >
          <IconHub size={18} />
          <span className="hidden lg:inline">Keremhub</span>
        </a>
      </div>
    </header>
  );
}
