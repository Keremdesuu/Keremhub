import { shuffleSeed } from "@/lib/shuffle";
import SortBar from "@/components/SortBar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clapperboard, Images } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { listMedia, parsePage, parseSort } from "@/lib/queries";
import Avatar from "@/components/Avatar";
import VideoCard from "@/components/VideoCard";
import PhotoCard from "@/components/PhotoCard";
import Pagination from "@/components/Pagination";
import Empty from "@/components/Empty";
import ProfileActions from "@/components/ProfileActions";
import ProfileUpload from "@/components/ProfileUpload";

export const dynamic = "force-dynamic";

export default async function ProfileDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; sort?: string; page?: string; seed?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();

  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) notFound();

  const [videoCount, photoCount, firstMedia] = await Promise.all([
    prisma.media.count({ where: { kind: "VIDEO", profiles: { some: { id } } } }),
    prisma.media.count({ where: { kind: "IMAGE", isAvatar: false, profiles: { some: { id } } } }),
    prisma.media.findFirst({ where: { profiles: { some: { id } } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);

  const tab = sp.tab === "photos" ? "photos" : "videos";
  const sort = parseSort(sp.sort);
  const page = parsePage(sp.page);
  const seed = sort === "random" ? shuffleSeed(sp.seed) : undefined;
  const { items, pages } = await listMedia({
    kind: tab === "photos" ? "IMAGE" : "VIDEO",
    sort,
    seed,
    page,
    profileId: id,
    pageSize: tab === "photos" ? 48 : 24,
  });

  const tabCls = (active: boolean) =>
    `flex items-center gap-2 border-b-[3px] px-4 py-2.5 text-sm font-bold uppercase tracking-wide ${
      active ? "border-brand text-brand" : "border-transparent hover:text-brand"
    }`;

  return (
    <>
      <section className="flex flex-wrap items-center gap-5 rounded-lg bg-panel p-5">
        <Avatar name={profile.name} mediaId={profile.avatarMediaId ?? firstMedia?.id} size={112} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{profile.name}</h1>
          <p className="mt-1 flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Clapperboard size={15} /> {videoCount} video
            </span>
            <span className="flex items-center gap-1.5">
              <Images size={15} /> {photoCount} fotoğraf
            </span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <ProfileUpload id={profile.id} avatar />
          <ProfileUpload id={profile.id} />
          <ProfileActions id={profile.id} name={profile.name} hidden={profile.hidden} avatarMediaId={profile.avatarMediaId} hasCustomAvatar={profile.avatarMediaId != null} />
        </div>
      </section>

      <div className="mt-5 flex gap-1 border-b border-panel">
        <Link href={`/profiles/${id}`} className={tabCls(tab === "videos")}>
          <Clapperboard size={16} /> Videolar ({videoCount})
        </Link>
        <Link href={`/profiles/${id}?tab=photos`} className={tabCls(tab === "photos")}>
          <Images size={16} /> Fotoğraflar ({photoCount})
        </Link>
      </div>

      <div className="mt-5">
        <SortBar basePath={`/profiles/${id}`} sort={sort} seed={seed} tab={tab === "photos" ? "photos" : undefined} hideUnassigned total={tab === "photos" ? photoCount : videoCount} label={tab === "photos" ? "Fotoğraflar" : "Videolar"} />
        {items.length === 0 ? (
          <Empty title={tab === "photos" ? "Bu profilde fotoğraf yok" : "Bu profilde video yok"} />
        ) : tab === "photos" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {items.map((p) => (
              <PhotoCard key={p.id} p={p} profileId={id} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.map((v) => (
              <VideoCard key={v.id} v={v} profileId={id} />
            ))}
          </div>
        )}
        <Pagination
          page={page}
          pages={pages}
          basePath={`/profiles/${id}`}
          params={{ sort: sort === "new" ? undefined : sort, seed, tab: tab === "photos" ? "photos" : undefined }}
        />
      </div>
    </>
  );
}
