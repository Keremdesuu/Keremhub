import { db } from '@/lib/db';

/** A reset is atomic: private shelves, files, and Kobo selection are untouched. */
export async function markBookUnread(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Geçersiz kitap kimliği.');
  await db.$transaction([
    db.progress.deleteMany({ where: { bookId: id } }),
    db.readingEntry.deleteMany({ where: { bookId: id } }),
    // Keep the reset newer than the Kobo cursor even after removing progress.
    db.book.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
}
