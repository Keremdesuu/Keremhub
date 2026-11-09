import type { Kind } from "@/lib/kinds";
import { kindAll, search } from "@/lib/queries";

export const dynamic = "force-dynamic";

const KINDS = new Set<Kind>(["SERIES", "MOVIE", "ANIME"]);

function readKind(value: string | null): Kind | undefined {
  return value && KINDS.has(value as Kind) ? (value as Kind) : undefined;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const kind = readKind(params.get("kind"));
  const items = query ? (await search(query)).filter((item) => !kind || item.kind === kind) : await kindAll(kind ?? "MOVIE");
  return Response.json({ version: 1, query, kind: kind ?? null, items: items.slice(0, 60) }, { headers: { "Cache-Control": "no-store" } });
}
