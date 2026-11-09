import { getBook } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) return Response.json({ error: "Geçersiz kimlik" }, { status: 400 });
  const book = await getBook(Number(id));
  if (!book) return Response.json({ error: "Kitap bulunamadı" }, { status: 404 });
  return Response.json(book, { headers: { "Cache-Control": "no-store" } });
}
