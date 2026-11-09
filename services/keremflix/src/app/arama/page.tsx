import { search } from "@/lib/queries";
import { TitleCard } from "@/components/TitleCard";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const items = await search(q);
  return (
    <div className="px-[4vw] pb-16 pt-28">
      <h1 className="m-title2 mb-6">&ldquo;{q}&rdquo; için sonuçlar</h1>
      {items.length === 0 ? (
        <p className="r-body text-gray-300">Eşleşen başlık bulunamadı.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
          {items.map((t) => <TitleCard key={t.id} t={t} width="100%" />)}
        </div>
      )}
    </div>
  );
}
