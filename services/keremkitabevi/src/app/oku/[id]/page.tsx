import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Reader from "@/components/Reader";
import { BASE_PATH } from "@/lib/config";
import { getBook } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const b = /^\d+$/.test(id) ? await getBook(Number(id)) : null;
  return { title: b ? `${b.title} okunuyor` : "Okuyucu" };
}

export default async function ReadPage({ params }: Params) {
  const { id } = await params;
  const book = /^\d+$/.test(id) ? await getBook(Number(id)) : null;
  if (!book) notFound();

  return (
    <Reader
      bookId={book.id}
      title={book.title}
      format={book.format}
      basePath={BASE_PATH}
      initialLocation={book.progress?.location ?? null}
      initialPercent={book.progress?.percent ?? 0}
    />
  );
}
