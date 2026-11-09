import { titleDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) {
    return Response.json({ error: "Geçersiz kimlik" }, { status: 400 });
  }
  const detail = await titleDetail(Number(id));
  if (!detail) return Response.json({ error: "Yapım bulunamadı" }, { status: 404 });
  return Response.json(detail, { headers: { "Cache-Control": "no-store" } });
}
