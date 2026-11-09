import Link from "next/link";
import { buildHref, type Filters } from "@/lib/queries";
import { IconAuthor, IconGenre, IconPdf, IconSeries } from "./icons";

type Facet = { id: number; name: string; _count: { books: number } };

function Group({
  title,
  icon,
  items,
  active,
  param,
  filters,
}: {
  title: string;
  icon: React.ReactNode;
  items: Facet[];
  active?: number;
  param: "yazar" | "seri" | "tur";
  filters: Filters;
}) {
  if (items.length === 0) return null;
  // Aktif öğe her zaman görünür kalsın
  const shown = items.slice(0, 10);
  const rest = items.slice(10);
  if (active && !shown.some((i) => i.id === active)) {
    const a = rest.find((i) => i.id === active);
    if (a) shown.push(a);
  }
  const restFiltered = rest.filter((i) => !shown.includes(i));

  const row = (i: Facet) => {
    const on = i.id === active;
    return (
      <li key={i.id}>
        <Link
          href={buildHref(filters, { [param]: on ? undefined : i.id })}
          aria-current={on ? "true" : undefined}
          className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm ${
            on ? "bg-signal/15 text-signal-soft" : "text-fg/85 hover:bg-surface"
          }`}
        >
          <span className="truncate">{i.name}</span>
          <span className="shrink-0 text-xs tabular-nums text-muted">{i._count.books}</span>
        </Link>
      </li>
    );
  };

  return (
    <details open={!!active || undefined} className="group border-b border-line/60 py-3 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1 text-sm font-semibold marker:hidden">
        <span className="text-signal">{icon}</span>
        {title}
        <span className="ml-auto text-xs font-normal text-muted">{items.length}</span>
      </summary>
      <ul className="mt-1.5 space-y-0.5">
        {shown.map(row)}
        {restFiltered.length > 0 && (
          <li>
            <details>
              <summary className="cursor-pointer px-2.5 py-1.5 text-sm text-signal-soft hover:underline">
                {restFiltered.length} tane daha
              </summary>
              <ul className="space-y-0.5">{restFiltered.map(row)}</ul>
            </details>
          </li>
        )}
      </ul>
    </details>
  );
}

export default function FilterPanel({
  filters,
  facets,
}: {
  filters: Filters;
  facets: {
    authors: Facet[];
    series: Facet[];
    genres: Facet[];
    formats: { format: string; count: number }[];
  };
}) {
  const anyActive = filters.q || filters.author || filters.series || filters.genre || filters.format;
  return (
    <div className="scroll-thin space-y-0 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-2">
      {anyActive && (
        <Link href="/kutuphane" className="mb-3 inline-block text-sm text-amber hover:underline">
          Filtreleri temizle
        </Link>
      )}
      <Group title="Yazarlar" icon={<IconAuthor size={18} />} items={facets.authors} active={filters.author} param="yazar" filters={filters} />
      <Group title="Seriler" icon={<IconSeries size={18} />} items={facets.series} active={filters.series} param="seri" filters={filters} />
      <Group title="Türler" icon={<IconGenre size={18} />} items={facets.genres} active={filters.genre} param="tur" filters={filters} />
      {facets.formats.length > 1 && (
        <details open className="py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-1 py-1 text-sm font-semibold marker:hidden">
            <span className="text-signal">
              <IconPdf size={18} />
            </span>
            Biçim
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {facets.formats.map((f) => {
              const on = filters.format === f.format;
              return (
                <li key={f.format}>
                  <Link
                    href={buildHref(filters, { bicim: on ? undefined : f.format })}
                    className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${
                      on ? "bg-signal/15 text-signal-soft" : "text-fg/85 hover:bg-surface"
                    }`}
                  >
                    <span>{f.format.toUpperCase()}</span>
                    <span className="text-xs tabular-nums text-muted">{f.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
