import { shuffleSeed } from "@/lib/shuffle";
import { listMedia, parsePage, parseSort } from "@/lib/queries";
import PhotoCard from "@/components/PhotoCard";
import SortBar from "@/components/SortBar";
import Pagination from "@/components/Pagination";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; sort?: string; page?: string; profile?: string; seed?: string }>;

export default async function PhotosPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const seed = sort === "random" ? shuffleSeed(sp.seed) : undefined;
  const q = sp.q?.trim() || undefined;
  const unassigned = sp.profile === "none";

  const { items, total, pages } = await listMedia({ kind: "IMAGE", q, sort, seed, page, unassigned, pageSize: 48 });

  return (
    <>
      <SortBar basePath="/photos" sort={sort} seed={seed} q={q} unassigned={unassigned} total={total} label="Fotoğraflar" />
      {items.length === 0 ? (
        <Empty
          title="Burada gösterilecek fotoğraf yok"
          hint="Medya klasörüne fotoğraf ekledikten sonra sağ üstteki “Tara” düğmesine bas."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {items.map((p) => (
            <PhotoCard key={p.id} p={p} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        pages={pages}
        basePath="/photos"
        params={{ q, seed, sort: sort === "new" ? undefined : sort, profile: unassigned ? "none" : undefined }}
      />
    </>
  );
}
