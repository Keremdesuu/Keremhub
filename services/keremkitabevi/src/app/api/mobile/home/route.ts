import { getHomeData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getHomeData(), { headers: { "Cache-Control": "no-store" } });
}
