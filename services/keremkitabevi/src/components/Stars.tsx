import { IconStar } from "./icons";

/** Salt okunur yıldızlar (kartlarda). */
export default function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5 text-amber" role="img" aria-label={`5 üzerinden ${value} puan`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconStar key={n} size={size} filled={n <= value} className={n <= value ? "" : "text-line"} />
      ))}
    </span>
  );
}
