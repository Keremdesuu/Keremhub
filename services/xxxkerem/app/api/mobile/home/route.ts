import { listMedia, listProfiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const [profiles, videos, photos] = await Promise.all([
    listProfiles(),
    listMedia({ kind: "VIDEO", sort: "new", page: 1, pageSize: 12 }),
    listMedia({ kind: "IMAGE", sort: "new", page: 1, pageSize: 12 }),
  ]);
  return Response.json({ version: 1, profiles, videos, photos }, { headers: { "Cache-Control": "no-store" } });
}
