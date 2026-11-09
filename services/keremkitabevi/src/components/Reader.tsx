"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book as EBook, Contents, NavItem, Rendition } from "epubjs";
import {
  IconBack,
  IconClose,
  IconDownload,
  IconFullscreen,
  IconMoon,
  IconNext,
  IconPaper,
  IconPrev,
  IconSun,
  IconToc,
  IconType,
} from "./icons";

type Props = {
  bookId: number;
  title: string;
  format: string;
  basePath: string;
  initialLocation: string | null;
  initialPercent: number;
};

type ThemeKey = "dark" | "sepia" | "light";
const THEMES: Record<ThemeKey, { bg: string; fg: string; label: string }> = {
  dark: { bg: "#10142b", fg: "#dfe3f7", label: "Gece" },
  sepia: { bg: "#f1e6cf", fg: "#3b3024", label: "Sepya" },
  light: { bg: "#fbfaf7", fg: "#1d1f2b", label: "Gündüz" },
};

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`kitabevi:${key}`);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`kitabevi:${key}`, JSON.stringify(value));
  } catch {
    /* gizli sekme vb.: ayar kaydedilemese de okuma sürer */
  }
}

export default function Reader(props: Props) {
  const { bookId, title, format, basePath } = props;
  const fileUrl = `${basePath}/api/books/${bookId}/file`;
  const downloadUrl = `${fileUrl}?download=1`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      {format === "pdf" ? (
        <PdfView title={title} fileUrl={fileUrl} downloadUrl={downloadUrl} bookId={bookId} />
      ) : (
        <EpubView {...props} fileUrl={fileUrl} downloadUrl={downloadUrl} />
      )}
    </div>
  );
}

function BarButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        active ? "bg-signal/20 text-signal-soft" : "text-muted hover:bg-surface hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function PdfView({ title, fileUrl, downloadUrl, bookId }: { title: string; fileUrl: string; downloadUrl: string; bookId: number }) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line bg-ink px-3 py-2">
        <Link href={`/kitap/${bookId}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg" aria-label="Kitap sayfasına dön" title="Kitap sayfasına dön">
          <IconBack size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        <a href={fileUrl} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface hover:text-fg">
          Yeni sekmede aç
        </a>
        <a href={downloadUrl} aria-label="İndir" title="İndir" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg">
          <IconDownload size={20} />
        </a>
      </div>
      <iframe title={title} src={`${fileUrl}#view=FitH`} className="min-h-0 w-full flex-1 bg-white" />
    </>
  );
}

function EpubView({
  bookId,
  title,
  fileUrl,
  downloadUrl,
  basePath,
  initialLocation,
  initialPercent,
}: Props & { fileUrl: string; downloadUrl: string }) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);
  const bookRef = useRef<EBook | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [theme, setTheme] = useState<ThemeKey>("dark");
  const [fontSize, setFontSize] = useState(110);
  const [scrolled, setScrolled] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [percent, setPercent] = useState(initialPercent);
  const [chapter, setChapter] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const themeRef = useRef(theme);
  const fontSizeRef = useRef(fontSize);
  themeRef.current = theme;
  fontSizeRef.current = fontSize;

  const applyAppearance = useCallback(() => {
    const activeRendition = rendition.current;
    if (!activeRendition) return;

    const contents = activeRendition.getContents() as unknown as Contents[];
    const activeTheme = THEMES[themeRef.current];
    for (const content of contents) {
      const root = content.document.documentElement;
      const body = content.document.body;
      for (const element of [root, body]) {
        element.style.setProperty("background", activeTheme.bg, "important");
        element.style.setProperty("color", activeTheme.fg, "important");
      }
      body.style.setProperty("font-size", `${fontSizeRef.current}%`, "important");
      body.style.setProperty("font-family", "'Source Serif 4 Variable', Georgia, serif", "important");
    }
  }, []);

  // Kayıtlı ayarları yükle
  useEffect(() => {
    setTheme(loadPref<ThemeKey>("theme", "dark"));
    setFontSize(loadPref("fontSize", 110));
    setScrolled(loadPref("scrolled", false));
  }, []);

  const saveProgress = useCallback(
    (location: string, p: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`${basePath}/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location, percent: p }),
        }).catch(() => {});
      }, 800);
    },
    [basePath, bookId]
  );

  // Kitabı aç
  useEffect(() => {
    let cancelled = false;
    let book: EBook | null = null;
    let keyboardHandler: ((event: KeyboardEvent) => void) | undefined;
    let registerKeyboard: (() => void) | undefined;
    const keyboardDocuments = new Set<Document>();

    (async () => {
      try {
        const { default: ePub } = await import("epubjs");
        if (cancelled || !host.current) return;
        book = ePub(fileUrl, { openAs: "epub" });
        bookRef.current = book;
        const r = book.renderTo(host.current, {
          width: "100%",
          height: "100%",
          flow: loadPref("scrolled", false) ? "scrolled-doc" : "paginated",
          spread: "auto",
          allowScriptedContent: false,
        });
        rendition.current = r;

        for (const [k, t] of Object.entries(THEMES)) {
          r.themes.register(k, {
            "html, body": { background: `${t.bg} !important`, color: `${t.fg} !important` },
            body: { "line-height": "1.7", "font-family": "'Source Serif 4 Variable', Georgia, serif !important" },
            "a, a:link": { color: "#7a8cff !important" },
          });
        }
        r.themes.select(loadPref<ThemeKey>("theme", "dark"));
        r.themes.override("font-size", `${loadPref("fontSize", 110)}%`, true);

        r.on("relocated", (loc: { start: { cfi: string; href: string; percentage?: number } }) => {
          const b = bookRef.current;
          if (!b) return;
          const cfi = loc.start.cfi;
          const p = b.locations.length() ? b.locations.percentageFromCfi(cfi) : (loc.start.percentage ?? 0);
          setPercent(p);
          saveProgress(cfi, p);
          const item = b.navigation?.get?.(loc.start.href);
          if (item?.label) setChapter(item.label.trim());
        });
        keyboardHandler = (event: KeyboardEvent) => {
          if (
            event.defaultPrevented ||
            event.repeat ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          ) return;

          const target = event.target as HTMLElement | null;
          if (target?.closest?.("input, textarea, select, [contenteditable='true'], [role='slider']")) return;

          if (event.key === "Escape") {
            setTocOpen(false);
            return;
          }
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

          event.preventDefault();
          event.stopPropagation();
          if (event.key === "ArrowLeft") void r.prev();
          else void r.next();
        };

        registerKeyboard = () => {
          const contents = r.getContents() as unknown as Contents[];
          for (const content of contents) {
            const doc = content.document;
            if (keyboardDocuments.has(doc)) continue;
            doc.addEventListener("keydown", keyboardHandler!, true);
            keyboardDocuments.add(doc);
          }
          applyAppearance();
        };
        window.addEventListener("keydown", keyboardHandler);
        r.on("rendered", registerKeyboard);

        await book.ready;
        book.loaded.navigation.then((nav) => !cancelled && setToc(nav.toc));
        await r.display(initialLocation ?? undefined);
        if (cancelled) return;
        registerKeyboard?.();
        setState("ready");
        // Yüzde hesabı için konumları arka planda üret
        book.locations.generate(1600).then(() => {
          const cur = r.currentLocation() as unknown as { start?: { cfi: string } };
          if (!cancelled && cur?.start?.cfi) setPercent(book!.locations.percentageFromCfi(cur.start.cfi));
        });
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setErrorMsg((e as Error).message || "Kitap açılamadı");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (keyboardHandler) {
        window.removeEventListener("keydown", keyboardHandler);
        for (const doc of keyboardDocuments) doc.removeEventListener("keydown", keyboardHandler, true);
      }
      if (registerKeyboard) rendition.current?.off("rendered", registerKeyboard);
      rendition.current?.destroy();
      book?.destroy();
      rendition.current = null;
      bookRef.current = null;
    };
  }, [fileUrl, initialLocation, saveProgress, applyAppearance]);

  // Ayar değişimleri
  useEffect(() => {
    rendition.current?.themes.select(theme);
    applyAppearance();
    savePref("theme", theme);
  }, [theme, state, applyAppearance]);
  useEffect(() => {
    rendition.current?.themes.override("font-size", `${fontSize}%`, true);
    applyAppearance();
    savePref("fontSize", fontSize);
  }, [fontSize, state, applyAppearance]);
  useEffect(() => {
    rendition.current?.flow(scrolled ? "scrolled-doc" : "paginated");
    savePref("scrolled", scrolled);
  }, [scrolled, state]);

  function seek(v: number) {
    const b = bookRef.current;
    if (!b || !b.locations.length()) return;
    const cfi = b.locations.cfiFromPercentage(v);
    if (cfi) rendition.current?.display(cfi);
  }

  const t = THEMES[theme];
  const pctLabel = `%${Math.round(percent * 100)}`;

  return (
    <>
      <div className="flex items-center gap-1 border-b border-line bg-ink px-3 py-2">
        <Link href={`/kitap/${bookId}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg" aria-label="Kitap sayfasına dön" title="Kitap sayfasına dön">
          <IconBack size={20} />
        </Link>
        <div className="min-w-0 flex-1 px-2">
          <h1 className="truncate text-sm font-medium">{title}</h1>
          {chapter && <p className="truncate text-xs text-muted">{chapter}</p>}
        </div>

        <BarButton label="İçindekiler" onClick={() => setTocOpen((o) => !o)} active={tocOpen}>
          <IconToc size={20} />
        </BarButton>
        <BarButton label="Yazıyı küçült" onClick={() => setFontSize((s) => Math.max(70, s - 10))}>
          <IconType size={17} />
        </BarButton>
        <span className="w-10 text-center text-xs tabular-nums text-muted">{fontSize}%</span>
        <BarButton label="Yazıyı büyüt" onClick={() => setFontSize((s) => Math.min(220, s + 10))}>
          <IconType size={23} />
        </BarButton>
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <div className="hidden items-center sm:flex">
          <BarButton label="Gündüz teması" onClick={() => setTheme("light")} active={theme === "light"}>
            <IconSun size={20} />
          </BarButton>
          <BarButton label="Sepya teması" onClick={() => setTheme("sepia")} active={theme === "sepia"}>
            <IconPaper size={20} />
          </BarButton>
          <BarButton label="Gece teması" onClick={() => setTheme("dark")} active={theme === "dark"}>
            <IconMoon size={20} />
          </BarButton>
        </div>
        <BarButton label={scrolled ? "Sayfa sayfa oku" : "Kaydırarak oku"} onClick={() => setScrolled((s) => !s)} active={scrolled}>
          <IconFullscreen size={20} />
        </BarButton>
        <a href={downloadUrl} aria-label="İndir" title="İndir" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg">
          <IconDownload size={20} />
        </a>
      </div>

      <div className="relative min-h-0 flex-1" style={{ background: t.bg }}>
        <div ref={host} className="absolute inset-x-0 inset-y-0 mx-auto max-w-4xl px-2 sm:px-10" />
        {state === "loading" && (
          <p className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: t.fg }}>
            Kitap açılıyor…
          </p>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" style={{ color: t.fg }}>
            <p className="font-medium">Kitap açılamadı</p>
            <p className="max-w-md text-sm opacity-70">{errorMsg}. Dosya bozuk olabilir; indirip başka bir okuyucuda deneyebilirsin.</p>
            <a href={downloadUrl} className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-ink">
              İndir
            </a>
          </div>
        )}

        {!scrolled && state === "ready" && (
          <>
            <button type="button" aria-label="Önceki sayfa" onClick={() => rendition.current?.prev()} className="absolute left-0 top-0 hidden h-full w-12 items-center justify-center opacity-0 transition-opacity hover:opacity-100 sm:flex" style={{ color: t.fg }}>
              <IconPrev size={28} />
            </button>
            <button type="button" aria-label="Sonraki sayfa" onClick={() => rendition.current?.next()} className="absolute right-0 top-0 hidden h-full w-12 items-center justify-center opacity-0 transition-opacity hover:opacity-100 sm:flex" style={{ color: t.fg }}>
              <IconNext size={28} />
            </button>
          </>
        )}

        {tocOpen && (
          <aside className="scroll-thin absolute inset-y-0 left-0 z-10 w-80 max-w-[85%] overflow-y-auto border-r border-line bg-surface p-3 shadow-2xl" aria-label="İçindekiler">
            <div className="mb-2 flex items-center justify-between px-2">
              <h2 className="text-sm font-semibold">İçindekiler</h2>
              <BarButton label="Kapat" onClick={() => setTocOpen(false)}>
                <IconClose size={18} />
              </BarButton>
            </div>
            {toc.length === 0 && <p className="px-2 text-sm text-muted">Bu kitapta içindekiler listesi yok.</p>}
            <ul>
              {toc.map((item) => (
                <TocRow
                  key={item.id}
                  item={item}
                  depth={0}
                  go={(href) => {
                    rendition.current?.display(href);
                    setTocOpen(false);
                  }}
                />
              ))}
            </ul>
          </aside>
        )}
      </div>

      <div className="flex items-center gap-4 border-t border-line bg-ink px-4 py-2.5">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(percent * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Kitapta konum"
          className="h-1.5 flex-1 cursor-pointer accent-[#ffb547]"
        />
        <span className="w-12 text-right text-sm tabular-nums text-muted">{pctLabel}</span>
      </div>
    </>
  );
}

function TocRow({ item, depth, go }: { item: NavItem; depth: number; go: (href: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => go(item.href)}
        className="w-full rounded-md px-2 py-1.5 text-left text-sm text-fg/90 hover:bg-raised"
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {item.label.trim()}
      </button>
      {item.subitems && item.subitems.length > 0 && (
        <ul>
          {item.subitems.map((s) => (
            <TocRow key={s.id} item={s} depth={depth + 1} go={go} />
          ))}
        </ul>
      )}
    </li>
  );
}
