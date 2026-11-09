import { parseFilters, searchBooks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = parseFilters({
    q: params.get("q") ?? undefined,
    bicim: params.get("format") ?? undefined,
    sayfa: params.get("page") ?? undefined,
    yazar: params.get("authorId") ?? undefined,
    seri: params.get("seriesId") ?? undefined,
    tur: params.get("genreId") ?? undefined,
  });
  return Response.json(await searchBooks(filters), { headers: { "Cache-Control": "no-store" } });
}
