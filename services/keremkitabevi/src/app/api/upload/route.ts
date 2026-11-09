import { NextResponse } from "next/server";
import { LIBRARY_DIR } from "@/lib/config";
import { saveBookUpload, UploadError } from "@/lib/book-upload";
import { scanLibrary } from "@/lib/scanner";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (origin !== new URL(request.url).origin && new URL(origin).host !== request.headers.get("host")) throw new Error(); }
    catch { return NextResponse.json({ error: "Bu adresten yüklemeye izin verilmiyor." }, { status: 403 }); }
  }
  try {
    let name: string;
    try { name = decodeURIComponent(request.headers.get("x-file-name") ?? ""); } catch { throw new UploadError("Dosya adı okunamadı."); }
    const saved = await saveBookUpload(LIBRARY_DIR, name, request.body, Number(request.headers.get("content-length")));
    let warning: string | undefined;
    try { await scanLibrary({ removeMissing: false }); }
    catch { warning = "Dosya HDD’ye kaydedildi. Kütüphaneye eklemek için tarama tamamlandıktan sonra Kütüphaneyi tara’ya bas."; }
    let book: { id: number } | null = null;
    try { book = await db.book.findUnique({ where: { relPath: saved.name }, select: { id: true } }); }
    catch { warning = "Dosya HDD’ye kaydedildi ancak kütüphane şu anda güncellenemiyor. Daha sonra Kütüphaneyi tara’ya bas."; }
    if (!book && !warning) warning = "Dosya HDD’ye kaydedildi ancak kitap bilgileri okunamadı. Kütüphaneyi yeniden tarayabilirsin.";
    return NextResponse.json({ name: saved.name, bytes: saved.bytes, bookId: book?.id, warning }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error && error.message.startsWith("HDD bağlı değil") ? "HDD bağlı değil. Dosya kaydedilmedi." : "Dosya kaydedilemedi. HDD bağlantısını ve boş alanı kontrol et.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
