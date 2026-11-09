import { NextResponse } from "next/server";
import { scanLibrary } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await scanLibrary());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
