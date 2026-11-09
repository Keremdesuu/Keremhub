import { listMedia, listProfiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profileId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(profileId) || profileId < 1) return Response.json({ error: "Geçersiz kimlik" }, { status: 400 });
  const profile = (await listProfiles()).find((item) => item.id === profileId);
  if (!profile) return Response.json({ error: "Profil bulunamadı" }, { status: 404 });
  const [videos, photos] = await Promise.all([
    listMedia({ kind: "VIDEO", sort: "new", page: 1, pageSize: 12, profileId }),
    listMedia({ kind: "IMAGE", sort: "new", page: 1, pageSize: 12, profileId }),
  ]);
  return Response.json({ version: 1, profile, videos: { version: 1, kind: "VIDEO", page: 1, ...videos }, photos: { version: 1, kind: "IMAGE", page: 1, ...photos } }, { headers: { "Cache-Control": "no-store" } });
}
