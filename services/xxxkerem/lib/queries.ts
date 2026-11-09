import type { Prisma } from "@prisma/client";
import { shuffled, shuffleSeed } from "./shuffle";
import { prisma } from "./prisma";
import { PAGE_SIZE } from "./config";

export const libraryVisibility: Prisma.MediaWhereInput = { isAvatar: false, profiles: { none: { hidden: true } } };

export type Sort = "new" | "views" | "title" | "random";

export function parseSort(v: string | undefined): Sort {
  return v === "views" || v === "title" || v === "random" ? v : "new";
}

export function parsePage(v: string | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

const orderBy = (sort: Sort) =>
  sort === "views"
    ? [{ views: "desc" as const }, { id: "desc" as const }]
    : sort === "title"
      ? [{ title: "asc" as const }]
      : [{ createdAt: "desc" as const }, { id: "desc" as const }];

export const mediaInclude = {
  profiles: { select: { id: true, name: true, avatarMediaId: true } },
} as const;

export async function listMedia(opts: {
  kind: "VIDEO" | "IMAGE";
  q?: string;
  sort: Sort;
  page: number;
  profileId?: number;
  unassigned?: boolean;
  pageSize?: number;
  seed?: string;
}) {
  const take = opts.pageSize ?? PAGE_SIZE;
  const where: Prisma.MediaWhereInput = {
    isAvatar: false,
    ...(!opts.profileId ? { AND: [libraryVisibility] } : {}),
    kind: opts.kind,
    ...(opts.q ? { title: { contains: opts.q } } : {}),
    ...(opts.profileId ? { profiles: { some: { id: opts.profileId } } } : {}),
    ...(opts.unassigned ? { profiles: { none: {} } } : {}),
  };
  if (opts.sort === "random") {
    const result = await randomMedia(where, take, shuffleSeed(opts.seed), (opts.page - 1) * take);
    return { ...result, pages: Math.max(1, Math.ceil(result.total / take)) };
  }
  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: orderBy(opts.sort),
      skip: (opts.page - 1) * take,
      take,
      include: mediaInclude,
    }),
    prisma.media.count({ where }),
  ]);
  return { items, total, pages: Math.max(1, Math.ceil(total / take)) };
}

export async function listProfiles(q?: string) {
  const profiles = await prisma.profile.findMany({
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { name: "asc" },
    include: {
      media: { where: { isAvatar: false }, select: { id: true, kind: true }, orderBy: { createdAt: "desc" } },
    },
  });
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    hidden: p.hidden,
    avatarMediaId: p.avatarMediaId ?? p.media[0]?.id ?? null,
    videos: p.media.filter((m) => m.kind === "VIDEO").length,
    photos: p.media.filter((m) => m.kind === "IMAGE").length,
  }));
}

/** Only IDs are shuffled; fetch full metadata for the selected page. */
export async function randomMedia(where: Prisma.MediaWhereInput, take: number, seed = shuffleSeed(), skip = 0) {
  const candidates = await prisma.media.findMany({ where, select: { id: true }, orderBy: { id: "asc" } });
  const ids = shuffled(candidates.map(x => x.id), seed).slice(skip, skip + take);
  const rows = ids.length ? await prisma.media.findMany({ where: { id: { in: ids } }, include: mediaInclude }) : [];
  const byId = new Map(rows.map(x => [x.id, x]));
  return { items: ids.flatMap(id => { const row = byId.get(id); return row ? [row] : []; }), total: candidates.length };
}
export async function recommendedVideos(id: number, profileIds: number[], profileId?: number) {
  if (profileId) return (await randomMedia({ kind: "VIDEO", isAvatar: false, id: { not: id }, profiles: { some: { id: profileId } } }, 8)).items;
  const same = profileIds.length ? (await randomMedia({ AND: [libraryVisibility], kind: "VIDEO", id: { not: id }, profiles: { some: { id: { in: profileIds } } } }, 4)).items : [];
  const more = (await randomMedia({ AND: [libraryVisibility], kind: "VIDEO", id: { notIn: [id, ...same.map(x => x.id)] } }, 8 - same.length)).items;
  return shuffled([...same, ...more], shuffleSeed());
}

export async function photoNeighbors(id: number, profileId?: number) {
  const scope: Prisma.MediaWhereInput = profileId
    ? { isAvatar: false, profiles: { some: { id: profileId } } }
    : libraryVisibility;
  const [newer, older] = await Promise.all([
    prisma.media.findFirst({ where: { AND: [scope], kind: "IMAGE", id: { gt: id } }, orderBy: { id: "asc" }, select: { id: true, mtime: true } }),
    prisma.media.findFirst({ where: { AND: [scope], kind: "IMAGE", id: { lt: id } }, orderBy: { id: "desc" }, select: { id: true, mtime: true } }),
  ]);
  return { newer, older };
}
