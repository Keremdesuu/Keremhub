import { BASE } from "@/lib/url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { photoNeighbors, mediaInclude } from "@/lib/queries";
import MediaSettings from "@/components/MediaSettings";
import ViewCounter from "@/components/ViewCounter";
import PhotoNav from "@/components/PhotoNav";
import PhotoViewer from "@/components/PhotoViewer";

export const dynamic = "force-dynamic";

export default async function PhotoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ profileId?: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const photo = await prisma.media.findUnique({ where: { id }, include: mediaInclude });
  if (!photo || photo.kind !== "IMAGE" || photo.isAvatar) notFound();

  const rawProfile = (await searchParams).profileId;
  const profileId = rawProfile === undefined ? undefined : Number(rawProfile);
  if (rawProfile !== undefined && (!/^\d+$/.test(rawProfile) || !Number.isSafeInteger(profileId) || profileId! < 1 || !photo.profiles.some(p => p.id === profileId))) notFound();
  const { newer, older } = await photoNeighbors(id, profileId);
  const suffix = profileId ? `?profileId=${profileId}` : "";


  return (
    <div className="mx-auto max-w-5xl">
      <Link href={profileId ? `/profiles/${profileId}?tab=photos` : "/photos"} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft size={16} /> {profileId ? "Profil fotoğraflarına dön" : "Fotoğraflara dön"}
      </Link>

      <PhotoViewer
        mediaId={photo.id}
        src={`${BASE}/api/file/${photo.id}?v=${photo.mtime.getTime()}`}
        previewSrc={`${BASE}/api/preview/${photo.id}?v=${photo.mtime.getTime()}`}
        adjacentPreviews={[newer, older].filter((m): m is NonNullable<typeof m> => !!m).map(m => `${BASE}/api/preview/${m.id}?v=${m.mtime.getTime()}`)}
        alt={photo.title}
        prevHref={newer ? `/photo/${newer.id}${suffix}` : null}
        nextHref={older ? `/photo/${older.id}${suffix}` : null}
      />

      <MediaSettings mediaId={photo.id} title={photo.title} profiles={photo.profiles} kind="photo" />
      <ViewCounter id={photo.id} />
      <PhotoNav prev={newer ? `/photo/${newer.id}${suffix}` : null} next={older ? `/photo/${older.id}${suffix}` : null} />
    </div>
  );
}
