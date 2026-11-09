import { db } from "./db";

import { type Status } from "./tracking-shared";
export { STATUSES, statusLabel } from "./tracking-shared";
export type { Status } from "./tracking-shared";

const include = { author: true, series: true, genres: true, progress: true, koboState: { select: { downloadedAt: true } }, entry: true, shelves: true } as const;

export async function getTrackingOverview() {
  const [grouped, shelves, readEntries] = await Promise.all([
    db.readingEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    db.shelf.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { books: true } } } }),
    db.readingEntry.findMany({ where: { status: "read" }, select: { rating: true, finishedAt: true } }),
  ]);
  const count = (s: Status) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const year = new Date().getFullYear();
  const rated = readEntries.filter((e) => e.rating);
  return {
    counts: {
      reading: count("reading"),
      want: count("want"),
      read: count("read"),
      dropped: count("dropped"),
    } as Record<Status, number>,
    shelves,
    readThisYear: readEntries.filter((e) => e.finishedAt && e.finishedAt.getFullYear() === year).length,
    avgRating: rated.length ? rated.reduce((a, e) => a + (e.rating ?? 0), 0) / rated.length : null,
  };
}

export async function getShelfBooks(opts: { status?: Status; shelfId?: number }) {
  if (opts.shelfId) {
    return db.book.findMany({
      where: { shelves: { some: { id: opts.shelfId } } },
      include,
      orderBy: { title: "asc" },
    });
  }
  const entries = await db.readingEntry.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: opts.status === "read" ? { finishedAt: "desc" } : { updatedAt: "desc" },
    include: { book: { include } },
  });
  return entries.map((e) => e.book);
}

export async function getBookTracking(bookId: number) {
  const [entry, shelves, mine] = await Promise.all([
    db.readingEntry.findUnique({ where: { bookId } }),
    db.shelf.findMany({ orderBy: { name: "asc" } }),
    db.book.findUnique({ where: { id: bookId }, select: { shelves: { select: { id: true } } } }),
  ]);
  return {
    entry,
    shelves,
    shelfIds: (mine?.shelves ?? []).map((s) => s.id),
  };
}

export type ShelfBook = Awaited<ReturnType<typeof getShelfBooks>>[number];
