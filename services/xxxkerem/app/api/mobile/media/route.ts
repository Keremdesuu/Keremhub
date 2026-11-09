import { listMedia, parsePage, parseSort } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") === "IMAGE" ? "IMAGE" : "VIDEO";
  const rawProfile = Number(params.get("profileId"));
  const profileId = Number.isSafeInteger(rawProfile) && rawProfile > 0 ? rawProfile : undefined;
  const result = await listMedia({ kind, profileId, page: parsePage(params.get("page") ?? undefined), sort: parseSort(params.get("sort") ?? undefined), q: params.get("q")?.trim() || undefined });
  return Response.json({ version: 1, kind, ...result }, { headers: { "Cache-Control": "no-store" } });
}
