import Link from "next/link";
import { Clapperboard, Images } from "lucide-react";
import Avatar from "./Avatar";

export default function ProfileCard({
  p,
}: {
  p: { id: number; name: string; avatarMediaId: number | null; videos: number; photos: number };
}) {
  return (
    <Link href={`/profiles/${p.id}`} className="group block">
      <div className="overflow-hidden rounded-lg bg-panel ring-1 ring-transparent transition group-hover:ring-brand">
        <div className="aspect-square w-full">
          <Avatar name={p.name} mediaId={p.avatarMediaId} size={400} square fill />
        </div>
      </div>
      <h3 className="mt-2 truncate text-sm font-bold group-hover:text-brand">{p.name}</h3>
      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Clapperboard size={12} /> {p.videos}
        </span>
        <span className="flex items-center gap-1">
          <Images size={12} /> {p.photos}
        </span>
      </p>
    </Link>
  );
}
