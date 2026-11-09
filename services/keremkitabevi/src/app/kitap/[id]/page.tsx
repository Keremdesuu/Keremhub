import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookDelete from "@/components/BookDelete";
import BookCover from "@/components/BookCover";
import TrackingPanel from "@/components/TrackingPanel";
import { getBookTracking, type Status } from "@/lib/tracking";
import { IconAuthor, IconDownload, IconGenre, IconRead, IconSeries } from "@/components/icons";
import { BASE_PATH } from "@/lib/config";
import { setBookKoboSync } from "@/app/kobo/actions";
import { buildHref, formatLabel, getBook, getSeriesBooks, humanSize } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const b = /^\d+$/.test(id) ? await getBook(Number(id)) : null;
  return { title: b?.title ?? "Kitap" };
}

export default async function BookPage({ params }: Params) {
  const { id } = await params;
  const book = /^\d+$/.test(id) ? await getBook(Number(id)) : null;
  if (!book) notFound();
  const siblings = book.seriesId ? await getSeriesBooks(book.seriesId) : [];
  const pct = book.progress ? Math.round(book.progress.percent * 100) : 0;
  const tracking = await getBookTracking(book.id);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[16rem_1fr]">
        <div className="mx-auto w-56 md:w-full">
          <div className="aspect-[2/3] overflow-hidden rounded-lg border border-line shadow-[0_24px_60px_-20px_rgba(122,140,255,0.35)]">
            <BookCover book={book} />
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">{book.title}</h1>
          {book.author && (
            <Link
              href={buildHref({}, { yazar: book.author.id })}
              className="mt-3 inline-flex items-center gap-2 text-lg text-signal-soft hover:underline"
            >
              <IconAuthor size={20} />
              {book.author.name}
            </Link>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href={`/oku/${book.id}`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-soft"
            >
              <IconRead size={18} />
              {pct > 0 ? `Okumaya devam et (%${pct})` : "Oku"}
            </Link>
            <a
              href={`${BASE_PATH}/api/books/${book.id}/file?download=1`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:border-signal"
            >
              <IconDownload size={18} />
              İndir ({formatLabel(book.format)}, {humanSize(book.sizeBytes)})
            </a>
            <form action={setBookKoboSync} className="flex min-w-0">
              <input type="hidden" name="id" value={book.id} />
              <input type="hidden" name="on" value={book.koboSync ? "false" : "true"} />
              <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:border-signal">{book.koboSync ? "Kobo listesinden çıkar" : "Kobo’ya ekle"}</button>
            </form>
            <Link
              href={`/kitap/${book.id}/duzenle`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:border-signal"
            >
              Kitap bilgilerini düzenle
            </Link>
          </div>

          <BookDelete id={book.id} />

          <ul className="mt-7 flex flex-wrap gap-2 text-sm">
            {book.series && (
              <li>
                <Link
                  href={buildHref({}, { seri: book.series.id })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 hover:border-signal"
                >
                  <IconSeries size={16} />
                  {book.series.name}
                  {book.seriesIndex != null && ` · ${book.seriesIndex}. kitap`}
                </Link>
              </li>
            )}
            {book.genres.map((g) => (
              <li key={g.id}>
                <Link href={buildHref({}, { tur: g.id })} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 hover:border-signal">
                  <IconGenre size={16} />
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>

          {book.description && <p className="mt-7 max-w-2xl font-serif text-lg leading-relaxed text-fg/90">{book.description}</p>}

          <TrackingPanel
            bookId={book.id}
            status={(tracking.entry?.status as Status | undefined) ?? null}
            rating={tracking.entry?.rating ?? null}
            shelves={tracking.shelves.map((s) => ({ id: s.id, name: s.name }))}
            shelfIds={tracking.shelfIds}
          />

          <dl className="mt-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {book.publisher && (
              <>
                <dt className="text-muted">Yayıncı</dt>
                <dd>{book.publisher}</dd>
              </>
            )}
            {book.year && (
              <>
                <dt className="text-muted">Yıl</dt>
                <dd>{book.year}</dd>
              </>
            )}
            {book.language && (
              <>
                <dt className="text-muted">Dil</dt>
                <dd>{book.language}</dd>
              </>
            )}
            <dt className="text-muted">Dosya</dt>
            <dd className="break-all">{book.relPath}</dd>
          </dl>
        </div>
      </div>

      {siblings.length > 1 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-semibold">{book.series?.name} serisi</h2>
          <ol className="divide-y divide-line/60 rounded-xl border border-line">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/kitap/${s.id}`}
                  aria-current={s.id === book.id ? "true" : undefined}
                  className={`flex items-center gap-4 px-4 py-3 text-sm hover:bg-surface ${s.id === book.id ? "bg-signal/10" : ""}`}
                >
                  <span className="w-8 text-right tabular-nums text-muted">{s.seriesIndex ?? "–"}</span>
                  <span className="font-medium">{s.title}</span>
                  <span className="ml-auto text-xs text-muted">{formatLabel(s.format)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
