import { BASE } from "@/lib/url";
import Link from "next/link";
import { UserRound } from "lucide-react";

export default function PhotoCard({
  p,
  profileId,
}: {
  profileId?: number;
  p: { id: number; mtime?: Date | string; title: string; profiles: { id: number; name: string }[] };
}) {
  return (
    <Link
      href={`/photo/${p.id}${profileId ? `?profileId=${profileId}` : ""}`}
      className="group relative block aspect-square overflow-hidden rounded-lg bg-panel ring-1 ring-transparent transition hover:ring-brand"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${BASE}/api/thumb/${p.id}?v=${p.mtime ? new Date(p.mtime).getTime() : 1}`}
        alt={p.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent p-2.5 pt-8 transition-transform group-hover:translate-y-0">
        <p className="line-clamp-1 text-xs font-semibold">{p.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
          <UserRound size={11} />
          {p.profiles.length ? p.profiles.map((x) => x.name).join(", ") : "Profil yok"}
        </p>
      </div>
    </Link>
  );
}
