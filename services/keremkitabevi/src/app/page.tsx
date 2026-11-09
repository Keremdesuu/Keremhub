import UploadButton from "@/components/UploadButton";
import Link from "next/link";
import BookCard from "@/components/BookCard";
import ScanButton from "@/components/ScanButton";
import Spines from "@/components/Spines";
import { IconLibrary } from "@/components/icons";
import { getHomeData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { total, authors, series, latest, reading, spines } = await getHomeData();

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="grid-paper absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <h1 className="max-w-4xl text-[clamp(3rem,9vw,7rem)] font-extrabold leading-[0.92] tracking-[-0.045em]">
            Kerem
            <br />
            Kitabevi
          </h1>
          <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-signal-soft/90">
            Rafındaki tüm e-kitaplar tek yerde. Yazara, seriye ve türe göre bul; tarayıcıda oku ya da indir.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/kutuphane"
              className="inline-flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-signal-soft"
            >
              <IconLibrary size={18} />
              Kütüphaneye gir
            </Link>
            <ScanButton />
            <UploadButton />
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-sm text-muted">
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">Kitap</dt>
              <dd className="text-2xl font-bold tabular-nums text-fg">{total}</dd>
              <span>kitap</span>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">Yazar</dt>
              <dd className="text-2xl font-bold tabular-nums text-fg">{authors}</dd>
              <span>yazar</span>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="sr-only">Seri</dt>
              <dd className="text-2xl font-bold tabular-nums text-fg">{series}</dd>
              <span>seri</span>
            </div>
          </dl>

          <div className="mt-12">
            <Spines spines={spines} />
            {total === 0 && (
              <p className="mt-4 text-sm text-muted">
                Raf boş. Kitaplarını HDD&apos;deki <code className="rounded bg-surface px-1.5 py-0.5 text-signal-soft">keremkitabevi</code> klasörüne koy ve
                &ldquo;Kütüphaneyi tara&rdquo;ya bas.
              </p>
            )}
          </div>
        </div>
      </section>

      {reading.length > 0 && (
        <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">Okumaya devam et</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {reading.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Son eklenenler</h2>
            <Link href="/kutuphane" className="text-sm text-signal-soft hover:underline">
              Tümünü gör
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {latest.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
