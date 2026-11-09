import Link from "next/link";
import BookCover from "./BookCover";
import { IconKobo } from "./icons";
import { formatLabel, type BookWithRels } from "@/lib/queries";

export default function BookCard({ book }: { book: BookWithRels }) {
  const pct = book.progress ? Math.round(book.progress.percent * 100) : 0;
  const koboTransferred = Boolean(book.koboState?.downloadedAt);
  const koboLabel = koboTransferred ? "Kobo’ya aktarıldı" : "Kobo gönderimi bekliyor";
  return (
    <Link href={`/kitap/${book.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-surface transition-transform duration-200 group-hover:-translate-y-1 group-hover:border-signal">
        <BookCover book={book} />
        {book.koboSync && (
          <span
            role="img"
            aria-label={koboLabel}
            title={`${koboLabel}. Son aktarım durumudur; cihazdan elle silinen kitaplar anlık izlenmez.`}
            className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-ink/90 px-1.5 py-1 text-[11px] font-semibold shadow-sm ring-1 backdrop-blur ${koboTransferred ? "text-emerald-200 ring-emerald-400/40" : "text-amber-200 ring-amber-400/40"}`}
          >
            <IconKobo size={16} transferred={koboTransferred} />
            <span aria-hidden="true">Kobo</span>
          </span>
        )}
        <span className="absolute right-2 top-2 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium text-signal-soft backdrop-blur">
          {formatLabel(book.format)}
        </span>
        {pct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-ink/70">
            <div className="h-full bg-amber" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <h3 className="mt-2.5 line-clamp-2 text-sm font-medium leading-snug group-hover:text-signal-soft">{book.title}</h3>
      <p className="mt-0.5 truncate text-xs text-muted">{book.author?.name ?? "Yazar bilinmiyor"}</p>
    </Link>
  );
}
