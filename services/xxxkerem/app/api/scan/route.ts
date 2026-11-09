import { scanLibrary } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 3600;

let running = false;

export async function POST() {
  if (running) return Response.json({ error: "Tarama zaten sürüyor" }, { status: 409 });
  running = true;
  try {
    return Response.json(await scanLibrary());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Tarama başarısız" }, { status: 500 });
  } finally {
    running = false;
  }
}
