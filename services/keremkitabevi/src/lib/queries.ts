import { matchesSearch } from "./search";
import { db } from "./db";
import { PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./config";

const tr = new Intl.Collator("tr", { sensitivity: "base", numeric: true });

export type Sort = "yeni" | "baslik" | "yazar";

export type Filters = {
  q?: string;
  author?: number;
  series?: number;
  genre?: number;
  format?: string;
  sort: Sort;
  page: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
};

type Raw = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export function parseFilters(sp: Raw): Filters {
  const sort = one(sp.sirala);
  const fmt = one(sp.bicim);
  return {
    q: one(sp.q)?.trim() || undefined,
    author: num(one(sp.yazar)),
    series: num(one(sp.seri)),
    genre: num(one(sp.tur)),
    format: fmt === "epub" || fmt === "pdf" || fmt === "kepub" ? fmt : undefined,
    sort: sort === "baslik" || sort === "yazar" ? sort : "yeni",
    page: Math.max(1, num(one(sp.sayfa)) ?? 1),
    pageSize: PAGE_SIZE_OPTIONS.find((size) => size === num(one(sp.adet))) ?? PAGE_SIZE,
  };
}

export function buildHref(f: Partial<Filters>, patch: Partial<Record<string, string | number | undefined>> = {}) {
  const p = new URLSearchParams();
  const merged: Record<string, string | number | undefined> = {
    q: f.q,
    yazar: f.author,
    seri: f.series,
    tur: f.genre,
    bicim: f.format,
    sirala: f.sort && f.sort !== "yeni" ? f.sort : undefined,
    sayfa: f.page && f.page > 1 ? f.page : undefined,
    adet: f.pageSize && f.pageSize !== PAGE_SIZE ? f.pageSize : undefined,
    ...patch,
  };
  // Filtre değişince ilk sayfaya dön
  if (!("sayfa" in patch)) delete merged.sayfa;
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return `/kutuphane${qs ? `?${qs}` : ""}`;
}

const bookInclude = { author: true, series: true, genres: true, progress: true, koboState: { select: { downloadedAt: true } } } as const;

export async function searchBooks(f: Filters) {
  const and: object[] = [];
  if (f.author) and.push({ authorId: f.author });
  if (f.series) and.push({ seriesId: f.series });
  if (f.genre) and.push({ genres: { some: { id: f.genre } } });
  if (f.format) and.push({ format: f.format });

  const candidates = await db.book.findMany({
    where: and.length ? { AND: and } : undefined,
    select: { id: true, title: true, addedAt: true, seriesIndex: true, author: { select: { name: true } }, series: { select: { name: true } } },
  });

  const rows = f.q ? candidates.filter(book => matchesSearch(f.q!, [book.title, book.author?.name, book.series?.name])) : candidates;

  rows.sort((a, b) => {
    if (f.series) return (a.seriesIndex ?? 1e9) - (b.seriesIndex ?? 1e9) || tr.compare(a.title, b.title);
    if (f.sort === "baslik") return tr.compare(a.title, b.title);
    if (f.sort === "yazar")
      return tr.compare(a.author?.name ?? "￿", b.author?.name ?? "￿") || tr.compare(a.title, b.title);
    return b.addedAt.getTime() - a.addedAt.getTime() || b.id - a.id;
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / f.pageSize));
  const page = Math.min(f.page, pages);
  const ids = rows.slice((page - 1) * f.pageSize, page * f.pageSize).map((r) => r.id);
  const books = await db.book.findMany({ where: { id: { in: ids } }, include: bookInclude });
  books.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return { books, total, pages, page };
}

export async function getFacets() {
  const [authors, series, genres, formats] = await Promise.all([
    db.author.findMany({ select: { id: true, name: true, _count: { select: { books: true } } } }),
    db.series.findMany({ select: { id: true, name: true, _count: { select: { books: true } } } }),
    db.genre.findMany({ select: { id: true, name: true, _count: { select: { books: true } } } }),
    db.book.groupBy({ by: ["format"], _count: { _all: true } }),
  ]);
  const sorted = <T extends { name: string }>(l: T[]) => l.sort((a, b) => tr.compare(a.name, b.name));
  return {
    authors: sorted(authors),
    series: sorted(series),
    genres: sorted(genres),
    formats: formats.map((f) => ({ format: f.format, count: f._count._all })),
  };
}

export async function getBook(id: number) {
  return db.book.findUnique({ where: { id }, include: bookInclude });
}

export async function getSeriesBooks(seriesId: number) {
  const list = await db.book.findMany({ where: { seriesId }, include: { author: true } });
  return list.sort((a, b) => (a.seriesIndex ?? 1e9) - (b.seriesIndex ?? 1e9) || tr.compare(a.title, b.title));
}

export async function getHomeData() {
  const [total, authors, series, latest, reading, spines] = await Promise.all([
    db.book.count(),
    db.author.count(),
    db.series.count(),
    db.book.findMany({ orderBy: { addedAt: "desc" }, take: 12, include: bookInclude }),
    db.progress.findMany({
      where: { percent: { lt: 0.98 } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { book: { include: bookInclude } },
    }),
    db.book.findMany({ orderBy: { id: "desc" }, take: 46, select: { id: true, title: true, coverHue: true, sizeBytes: true } }),
  ]);
  return { total, authors, series, latest, reading: reading.map((r) => r.book), spines };
}

export const formatLabel = (f: string) => (f === "pdf" ? "PDF" : f === "kepub" ? "KEPUB" : "EPUB");
export const humanSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export type BookWithRels = Awaited<ReturnType<typeof searchBooks>>["books"][number];
