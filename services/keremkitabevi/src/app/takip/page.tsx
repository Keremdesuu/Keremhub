import type { Metadata } from "next";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import ShelfDelete from "@/components/ShelfDelete";
import Stars from "@/components/Stars";
import { IconShelf } from "@/components/icons";
import { STATUSES, getShelfBooks, getTrackingOverview, type Status } from "@/lib/tracking";

export const metadata: Metadata = { title: "Takip" };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default async function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raf = Array.isArray(sp.raf) ? sp.raf[0] : sp.raf;
  const overview = await getTrackingOverview();

  const mainStatus = STATUSES.find((s) => s.slug === raf);
  const shelfId = raf?.startsWith("raf-") ? Number(raf.slice(4)) : undefined;
  const customShelf = overview.shelves.find((s) => s.id === shelfId);
  const current = mainStatus ?? (customShelf ? undefined : STATUSES[0]);

  const books = await getShelfBooks({ status: current?.key as Status | undefined, shelfId: customShelf?.id });
  const total = Object.values(overview.counts).reduce((a, b) => a + b, 0);

  const tab = (href: string, label: string, count: number, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
        active ? "bg-signal/15 font-medium text-signal-soft" : "text-fg/85 hover:bg-surface"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-xs tabular-nums text-muted">{count}</span>
    </Link>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Takip</h1>
      <p className="mt-1 text-sm text-muted">
        {total === 0
          ? "Henüz takip ettiğin kitap yok. Bir kitabın sayfasından raf seçerek başla."
          : `${overview.readThisYear} kitap bu yıl bitti${overview.avgRating ? ` · ortalama puanın ${overview.avgRating.toFixed(1)}` : ""}`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Raflar" className="space-y-6">
          <div className="space-y-0.5">
            {STATUSES.map((s) => tab(`/takip?raf=${s.slug}`, s.label, overview.counts[s.key], current?.key === s.key))}
          </div>
          <div>
            <h2 className="mb-1.5 flex items-center gap-2 px-3 text-sm font-semibold">
              <span className="text-signal">
                <IconShelf size={18} />
              </span>
              Raflarım
            </h2>
            {overview.shelves.length === 0 ? (
              <p className="px-3 text-sm text-muted">Kendi raflarını bir kitabın sayfasından oluşturabilirsin.</p>
            ) : (
              <div className="space-y-0.5">
                {overview.shelves.map((s) => tab(`/takip?raf=raf-${s.id}`, s.name, s._count.books, customShelf?.id === s.id))}
              </div>
            )}
          </div>
        </nav>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{current?.label ?? customShelf?.name}</h2>
              {current && <p className="text-sm text-muted">{current.hint}</p>}
            </div>
            {customShelf && <ShelfDelete shelfId={customShelf.id} name={customShelf.name} />}
          </div>

          {books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-10 text-center">
              <p className="font-medium">Bu rafta kitap yok</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">Kitap sayfasındaki Takip bölümünden kitapları rafa ekleyebilirsin.</p>
              <Link href="/kutuphane" className="mt-5 inline-block rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-soft">
                Kütüphaneye git
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {books.map((b) => (
                <div key={b.id}>
                  <BookCard book={b} />
                  {b.entry?.rating ? <div className="mt-1.5"><Stars value={b.entry.rating} /></div> : null}
                  {current?.key === "read" && b.entry?.finishedAt && (
                    <p className="mt-1 text-xs text-muted">{dateFmt.format(b.entry.finishedAt)}</p>
                  )}
                  {current?.key === "reading" && b.progress && (
                    <p className="mt-1 text-xs text-muted">%{Math.round(b.progress.percent * 100)} okundu</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
