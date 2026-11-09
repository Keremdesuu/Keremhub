import { BASE } from "@/lib/url";
import { initials } from "@/lib/format";

export default function Avatar({
  name,
  mediaId,
  size = 40,
  square = false,
  fill = false,
}: {
  name: string;
  mediaId?: number | null;
  size?: number;
  square?: boolean;
  fill?: boolean;
}) {
  const shape = square ? "rounded-lg" : "rounded-full";
  if (fill) {
    return mediaId ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`${BASE}/api/thumb/${mediaId}`} alt={name} className="h-full w-full object-cover" />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-brand text-4xl font-bold text-ink">
        {initials(name) || "?"}
      </div>
    );
  }
  if (mediaId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${BASE}/api/thumb/${mediaId}`}
        alt={name}
        width={size}
        height={size}
        className={`${shape} shrink-0 bg-panel object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${shape} flex shrink-0 items-center justify-center bg-brand font-bold text-ink`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name) || "?"}
    </div>
  );
}
