import { scanLibrary } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

let running = false;

export async function POST(req: Request) {
  if (running) return Response.json({ error: "Tarama zaten sürüyor" }, { status: 409 });
  const refetch = new URL(req.url).searchParams.get("refetch") === "1";
  running = true;
  try {
    const result = await scanLibrary({ refetchMissing: refetch });
    return Response.json(result);
  } catch {
    return Response.json({error:"Tarama tamamlanamadı; disk bağlantısını ve kaynak erişimini kontrol edin."},{status:500});
  } finally {
    running = false;
  }
}
