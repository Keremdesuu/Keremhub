import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Bu kitap rafta yok</h1>
      <p className="mt-3 text-muted">Silinmiş ya da taşınmış olabilir. Kütüphaneyi yeniden tarayıp tekrar dene.</p>
      <Link href="/kutuphane" className="mt-6 inline-block rounded-lg bg-signal px-5 py-2.5 text-sm font-semibold text-ink hover:bg-signal-soft">
        Kütüphaneye dön
      </Link>
    </main>
  );
}
