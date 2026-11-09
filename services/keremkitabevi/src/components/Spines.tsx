import Link from "next/link";

type S = { id: number; title: string; coverHue: number; sizeBytes: number };

const STEP = "0.045s";

function dims(id: number, size: number) {
  const a = (id * 2654435761) >>> 0;
  const width = 22 + (a % 5) * 5; // 22–42 px
  const height = 150 + ((a >>> 8) % 6) * 14 + Math.min(30, Math.floor(size / 2_000_000) * 4); // 150–250 px
  return { width, height };
}

/**
 * Ana sayfanın sahnesi: kütüphanedeki gerçek kitapların sırtları tek bir rafta.
 * Sayfa açılınca bir tarama ışını raftan geçer ve sırtlar sırayla renklenir.
 */
export default function Spines({ spines }: { spines: S[] }) {
  const empty = spines.length === 0;
  const items = empty
    ? Array.from({ length: 28 }, (_, i) => ({ id: i + 1, title: "", coverHue: 235, sizeBytes: 0 }))
    : spines;

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface/60 px-4 pt-8 sm:px-8">
        <div className="scroll-thin flex items-end gap-1 overflow-x-auto pb-0" aria-label={empty ? undefined : "Kütüphaneden kitap sırtları"}>
          {items.map((s, i) => {
            const { width, height } = dims(s.id, s.sizeBytes);
            const style = {
              width,
              height,
              "--i": i,
              "--step": STEP,
              background: empty
                ? "transparent"
                : `linear-gradient(90deg, hsl(${s.coverHue} 50% 34%), hsl(${s.coverHue} 46% 24%))`,
              borderColor: empty ? "var(--color-line)" : `hsl(${s.coverHue} 55% 48% / 0.55)`,
            } as React.CSSProperties;
            const inner = (
              <span
                className="spine flex h-full shrink-0 justify-center overflow-hidden rounded-t-[3px] border border-b-0 py-2.5"
                style={style}
              >
                {!empty && (
                  <span className="whitespace-nowrap text-[11px] font-medium tracking-wide text-white/85" style={{ writingMode: "vertical-rl" }}>
                    {s.title.length > 34 ? `${s.title.slice(0, 33)}…` : s.title}
                  </span>
                )}
              </span>
            );
            return empty ? (
              <span key={s.id} className="shrink-0 border-dashed" style={{ height }}>
                {inner}
              </span>
            ) : (
              <Link key={s.id} href={`/kitap/${s.id}`} title={s.title} className="shrink-0 transition-transform hover:-translate-y-2" style={{ height }}>
                {inner}
              </Link>
            );
          })}
        </div>
        <div className="h-3 rounded-b-md border-x border-b border-line bg-raised" />
        <div className="beam pointer-events-none absolute inset-y-0 left-0 w-24 -translate-x-full" aria-hidden="true">
          <div className="absolute inset-y-0 right-0 w-px bg-amber shadow-[0_0_18px_4px_rgba(255,181,71,0.55)]" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-amber/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}
