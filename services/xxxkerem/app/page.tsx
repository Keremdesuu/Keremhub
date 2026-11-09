import { shuffleSeed } from "@/lib/shuffle";
import { listMedia, parsePage, parseSort } from "@/lib/queries";
import VideoCard from "@/components/VideoCard";
import SortBar from "@/components/SortBar";
import Pagination from "@/components/Pagination";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; sort?: string; page?: string; profile?: string; seed?: string }>;

export default async function VideosPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const seed = sort === "random" ? shuffleSeed(sp.seed) : undefined;
  const q = sp.q?.trim() || undefined;
  const unassigned = sp.profile === "none";

  const { items, total, pages } = await listMedia({ kind: "VIDEO", q, sort, seed, page, unassigned });

  return (
    <>
      <SortBar basePath="/" sort={sort} seed={seed} q={q} unassigned={unassigned} total={total} label="Videolar" />
      {items.length === 0 ? (
        <Empty
          title="Burada gösterilecek video yok"
          hint="Medya klasörüne video ekledikten sonra sağ üstteki “Tara” düğmesine bas."
        />
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((v) => (
            <VideoCard key={v.id} v={v} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        pages={pages}
        basePath="/"
        params={{ q, seed, sort: sort === "new" ? undefined : sort, profile: unassigned ? "none" : undefined }}
      />
    </>
  );
}
