"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Status } from "@/lib/tracking";

const STATUS_VALUES = ["want", "reading", "read", "dropped"];

function refresh(bookId?: number) {
  revalidatePath("/takip");
  revalidatePath("/");
  if (bookId) revalidatePath(`/kitap/${bookId}`);
}

/** Ana raf seçimi. null: kitabı takipten çıkarır (puanı da silinir). */
export async function setStatus(bookId: number, status: Status | null) {
  if (status === null) {
    await db.readingEntry.deleteMany({ where: { bookId } });
    return refresh(bookId);
  }
  if (!STATUS_VALUES.includes(status)) throw new Error("Geçersiz raf");
  const prev = await db.readingEntry.findUnique({ where: { bookId } });
  const now = new Date();
  await db.readingEntry.upsert({
    where: { bookId },
    create: {
      bookId,
      status,
      startedAt: status === "reading" ? now : null,
      finishedAt: status === "read" ? now : null,
    },
    update: {
      status,
      startedAt: status === "reading" ? (prev?.startedAt ?? now) : prev?.startedAt,
      finishedAt: status === "read" ? now : status === "reading" ? null : prev?.finishedAt,
    },
  });
  refresh(bookId);
}

/** Puan 1–5; 0 puanı kaldırır. Takipte olmayan kitap puanlanırsa "Okundu" rafına girer. */
export async function setRating(bookId: number, rating: number) {
  const r = Math.round(rating);
  if (r < 0 || r > 5) throw new Error("Puan 0–5 arası olmalı");
  const now = new Date();
  await db.readingEntry.upsert({
    where: { bookId },
    create: { bookId, status: "read", rating: r || null, finishedAt: now },
    update: { rating: r || null },
  });
  refresh(bookId);
}

export async function createShelf(name: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!clean) return { error: "Raf adı boş olamaz" };
  const exists = await db.shelf.findUnique({ where: { name: clean } });
  if (exists) return { error: "Bu adda bir raf zaten var" };
  const shelf = await db.shelf.create({ data: { name: clean } });
  refresh();
  return { id: shelf.id };
}

export async function deleteShelf(shelfId: number) {
  await db.shelf.delete({ where: { id: shelfId } });
  refresh();
}

export async function toggleShelf(bookId: number, shelfId: number, on: boolean) {
  await db.book.update({
    where: { id: bookId },
    data: { shelves: on ? { connect: { id: shelfId } } : { disconnect: { id: shelfId } } },
  });
  refresh(bookId);
}
