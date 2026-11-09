import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pages,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;

  const href = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const nums = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const cell = "flex h-9 min-w-9 items-center justify-center rounded px-2 text-sm font-semibold transition-colors";

  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Sayfalar">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${cell} bg-panel hover:bg-brand hover:text-ink`} aria-label="Önceki">
          <ChevronLeft size={18} />
        </Link>
      )}
      {list.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - list[i - 1]! > 1 && <span className="text-muted">…</span>}
          <Link
            href={href(n)}
            className={`${cell} ${n === page ? "bg-brand text-ink" : "bg-panel hover:bg-brand hover:text-ink"}`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className={`${cell} bg-panel hover:bg-brand hover:text-ink`} aria-label="Sonraki">
          <ChevronRight size={18} />
        </Link>
      )}
    </nav>
  );
}
