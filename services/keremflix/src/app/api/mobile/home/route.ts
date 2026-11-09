import type { Kind } from "@/lib/kinds";
import { byGenre, continueWatching, heroPick, recent, topRated } from "@/lib/queries";

export const dynamic = "force-dynamic";

const KINDS = new Set<Kind>(["SERIES", "MOVIE", "ANIME"]);

function readKind(value: string | null): Kind | undefined {
  return value && KINDS.has(value as Kind) ? (value as Kind) : undefined;
}

export async function GET(request: Request) {
  const kind = readKind(new URL(request.url).searchParams.get("kind"));
  const [hero, continueItems, recentItems, topItems, genres] = await Promise.all([
    heroPick(kind),
    continueWatching(kind),
    recent(kind, 24),
    topRated(kind, 12),
    byGenre(kind, 6),
  ]);

  return Response.json({
    version: 1,
    kind: kind ?? null,
    hero,
    continueWatching: continueItems,
    recent: recentItems,
    topRated: topItems,
    genres,
  }, { headers: { "Cache-Control": "no-store" } });
}
