import { myList } from "@/lib/queries";
import { TitleCard } from "@/components/TitleCard";

export const dynamic = "force-dynamic";

export default async function MyList() {
  const items = await myList();
  return (
    <div className="px-[4vw] pb-16 pt-28">
      <h1 className="m-title2 mb-6">Listem</h1>
      {items.length === 0 ? (
        <p className="r-body text-gray-300">Listen boş. Bir başlığın üzerindeki + simgesine tıklayarak ekleyebilirsin.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
          {items.map((t) => <TitleCard key={t.id} t={t} width="100%" />)}
        </div>
      )}
    </div>
  );
}
