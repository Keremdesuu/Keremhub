import UploadButton from "@/components/UploadButton";
import type { Metadata } from "next";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import FilterPanel from "@/components/FilterPanel";
import ScanButton from "@/components/ScanButton";
import { IconFilter } from "@/components/icons";
import { buildHref, getFacets, parseFilters, searchBooks, type Sort } from "@/lib/queries";
import { PAGE_SIZE_OPTIONS } from "@/lib/config";

export const metadata: Metadata = { title: "Kütüphane" };
export const dynamic = "force-dynamic";

const SORTS: { key: Sort; label: string }[] = [
  { key: "yeni", label: "Yeni eklenen" },
  { key: "baslik", label: "Başlık" },
  { key: "yazar", label: "Yazar" },
];

export default async function Library({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [{ books, total, pages, page }, facets] = await Promise.all([searchBooks(filters), getFacets()]);

  const activeNames = [
    facets.authors.find((a) => a.id === filters.author)?.name,
    facets.series.find((s) => s.id === filters.series)?.name,
    facets.genres.find((g) => g.id === filters.genre)?.name,
    filters.q ? `“${filters.q}”` : undefined,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside>
          <details className="lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm marker:hidden">
              <IconFilter size={18} /> Filtreler
            </summary>
            <div className="mt-3 rounded-lg border border-line bg-surface/60 p-3">
              <FilterPanel filters={filters} facets={facets} />
            </div>
          </details>
          <div className="sticky top-20 hidden lg:block">
            <FilterPanel filters={filters} facets={facets} />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{activeNames.length ? activeNames.join(" · ") : "Tüm kitaplar"}</h1>
              <p className="mt-1 text-sm text-muted">{total} kitap</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <UploadButton />
              <nav aria-label="Sayfa başına kitap sayısı" className="flex items-center gap-1 rounded-lg border border-line p-1 text-sm">
                <span className="px-2 text-xs text-muted">Kitap/sayfa</span>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <Link
                    key={size}
                    href={buildHref(filters, { adet: size })}
                    aria-current={filters.pageSize === size ? "page" : undefined}
                    className={`rounded-md px-2.5 py-1.5 tabular-nums ${filters.pageSize === size ? "bg-signal text-ink" : "text-muted hover:text-fg"}`}
                  >
                    {size}
                  </Link>
                ))}
              </nav>
              <nav aria-label="Sıralama" className="flex items-center gap-1 rounded-lg border border-line p-1 text-sm">
              {SORTS.map((s) => (
                <Link
                  key={s.key}
                  href={buildHref(filters, { sirala: s.key === "yeni" ? undefined : s.key })}
                  aria-current={filters.sort === s.key ? "true" : undefined}
                  className={`rounded-md px-3 py-1.5 ${filters.sort === s.key ? "bg-signal text-ink" : "text-muted hover:text-fg"}`}
                >
                  {s.label}
                </Link>
              ))}
              </nav>
            </div>
          </div>

          {books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-10 text-center">
              <p className="text-lg font-medium">{total === 0 && !filters.q && !filters.author && !filters.series && !filters.genre ? "Kütüphane henüz boş" : "Bu filtreyle kitap bulunamadı"}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Kitapları HDD&apos;deki keremkitabevi klasörüne koyup taramayı başlat ya da filtreleri temizle.
              </p>
              <div className="mt-5 flex justify-center">
                <ScanButton variant="solid" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {books.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Sayfalar" className="mt-12 flex items-center justify-center gap-3 text-sm">
              {page > 1 && (
                <Link href={buildHref(filters, { sayfa: page - 1 })} className="rounded-lg border border-line px-4 py-2 hover:border-signal">
                  Önceki
                </Link>
              )}
              <span className="text-muted tabular-nums">
                {page} / {pages}
              </span>
              {page < pages && (
                <Link href={buildHref(filters, { sayfa: page + 1 })} className="rounded-lg border border-line px-4 py-2 hover:border-signal">
                  Sonraki
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
