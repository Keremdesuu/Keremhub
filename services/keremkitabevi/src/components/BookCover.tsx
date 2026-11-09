import { BASE_PATH } from "@/lib/config";

type Cover = { id: number; title: string; hasCover: boolean; coverHue: number; format: string };

/** Kapağı olmayan kitaplar için başlığa göre renklenen üretilmiş kapak. */
export default function BookCover({ book, className = "" }: { book: Cover; className?: string }) {
  if (book.hasCover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${BASE_PATH}/api/books/${book.id}/cover`}
        alt={`${book.title} kapağı`}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  const h = book.coverHue;
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden p-4 ${className}`}
      style={{ background: `linear-gradient(160deg, hsl(${h} 45% 30%), hsl(${(h + 40) % 360} 50% 16%))` }}
      role="img"
      aria-label={`${book.title} (kapak görseli yok)`}
    >
      <div className="absolute inset-y-0 left-3 w-px bg-white/15" />
      <p className="line-clamp-5 pl-3 font-serif text-lg font-semibold leading-snug text-white/95">{book.title}</p>
      <p className="pl-3 text-xs text-white/60">{book.format === "pdf" ? "PDF" : "E-kitap"}</p>
    </div>
  );
}
