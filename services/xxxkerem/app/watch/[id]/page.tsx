import Link from "next/link";
import { BASE } from "@/lib/url";
import { notFound } from "next/navigation";
import { Clock, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { mediaInclude, recommendedVideos } from "@/lib/queries";
import { formatDuration, formatViews, timeAgo } from "@/lib/format";
import MediaSettings from "@/components/MediaSettings";
import ViewCounter from "@/components/ViewCounter";
import VideoCard from "@/components/VideoCard";
import VideoPlayer from "@/components/VideoPlayer";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ profileId?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const video = await prisma.media.findUnique({ where: { id }, include: mediaInclude });
  if (!video || video.kind !== "VIDEO") notFound();

  const rawProfile = (await searchParams).profileId;
  const profileId = rawProfile === undefined ? undefined : Number(rawProfile);
  if (rawProfile !== undefined && (!/^\d+$/.test(rawProfile) || !Number.isSafeInteger(profileId) || profileId! < 1 || !video.profiles.some(p => p.id === profileId))) notFound();
  const related = await recommendedVideos(id, video.profiles.map(p => p.id), profileId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {profileId && <Link href={`/profiles/${profileId}`} className="mb-3 inline-block text-sm text-muted hover:text-brand">Profil videolarına dön</Link>}
        <div className="overflow-hidden rounded-lg bg-black ring-1 ring-panel">
          <VideoPlayer key={video.id} src={`${BASE}/api/file/${video.id}`} poster={`${BASE}/api/thumb/${video.id}`} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <Eye size={15} /> {formatViews(video.views)} izlenme
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={15} /> {timeAgo(video.createdAt)}
          </span>
          {video.duration ? <span>{formatDuration(video.duration)}</span> : null}
          {video.width && video.height ? (
            <span>
              {video.width}×{video.height}
            </span>
          ) : null}
        </div>

        <MediaSettings
          mediaId={video.id}
          title={video.title}
          profiles={video.profiles}
          kind="video"
        />
        <ViewCounter id={video.id} />
      </div>

      <aside>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-brand">{profileId ? "Bu profildeki diğer videolar" : "Önerilen videolar"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {related.map((v) => (
            <VideoCard key={v.id} v={v} profileId={profileId} />
          ))}
        </div>
      </aside>
    </div>
  );
}
