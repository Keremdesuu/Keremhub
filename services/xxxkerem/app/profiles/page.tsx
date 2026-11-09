import { listProfiles } from "@/lib/queries";
import ProfileCard from "@/components/ProfileCard";
import CreateProfile from "@/components/CreateProfile";
import Empty from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() || undefined;
  const profiles = await listProfiles(q);

  return (
    <>
      <h1 className="mb-5 text-lg font-extrabold">
        {q ? <>“{q}” için sonuçlar</> : "Profiller"}{" "}
        <span className="text-sm font-semibold text-muted">({profiles.length})</span>
      </h1>
      <CreateProfile />
      {profiles.length === 0 ? (
        <Empty
          title="Henüz profil yok"
          hint="Yukarıdaki “Yeni profil oluştur” düğmesiyle bir profil ekleyebilirsin."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {profiles.map((p) => (
            <ProfileCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}
