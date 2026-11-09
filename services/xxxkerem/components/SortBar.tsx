import { shuffleSeed } from "@/lib/shuffle";
import Link from "next/link";
import { Flame, Sparkles, SortAsc, UserX, Shuffle } from "lucide-react";

export default function SortBar({
  basePath,
  sort,
  q,
  unassigned,
  total,
  label,
  seed,
  tab,
  hideUnassigned,
}: {
  basePath: string;
  sort: string;
  q?: string;
  unassigned?: boolean;
  total: number;
  label: string;
  seed?: string;
  tab?: string;
  hideUnassigned?: boolean;
}) {
  const href = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      q,
      tab,
      seed: sort === "random" ? seed : undefined,
      sort: sort === "new" ? undefined : sort,
      profile: unassigned ? "none" : undefined,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const items = [
    { key: "new", label: "En yeni", icon: Sparkles },
    { key: "views", label: "En çok izlenen", icon: Flame },
    { key: "title", label: "A–Z", icon: SortAsc },
    { key: "random", label: "Rastgele", icon: Shuffle },
  ];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <h1 className="mr-3 text-lg font-extrabold">
        {q ? <>“{q}” için sonuçlar</> : label}{" "}
        <span className="text-sm font-semibold text-muted">({total})</span>
      </h1>
      {items.map(({ key, label, icon: Icon }) => (
        <Link
          key={key}
          href={href({ sort: key === "new" ? undefined : key, seed: key === "random" ? shuffleSeed() : undefined })}
          prefetch={key === "random" ? false : undefined}
          aria-current={sort === key ? "true" : undefined}
          title={key === "random" ? "Yeni bir rastgele sıra oluştur" : undefined}
          className={`chip ${sort === key ? "chip-active" : ""}`}
        >
          <Icon size={14} />
          {label}
        </Link>
      ))}
      {!hideUnassigned && <Link href={href({ profile: unassigned ? undefined : "none" })} className={`chip ${unassigned ? "chip-active" : ""}`}>
        <UserX size={14} />
        Profilsiz
      </Link>}
    </div>
  );
}
