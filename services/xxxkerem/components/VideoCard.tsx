"use client";

import { BASE } from "@/lib/url";
import Link from "next/link";
import { useState } from "react";
import { Clock, Eye, Play, UserRound } from "lucide-react";
import { formatDuration, formatViews, timeAgo } from "@/lib/format";

export type VideoItem = {
  id: number;
  title: string;
  duration: number | null;
  height: number | null;
  views: number;
  createdAt: Date | string;
  profiles: { id: number; name: string }[];
};

export default function VideoCard({ v, profileId }: { v: VideoItem; profileId?: number }) {
  const [hover, setHover] = useState(false);
  const quality = v.height ? (v.height >= 2000 ? "4K" : v.height >= 1000 ? "FHD" : v.height >= 700 ? "HD" : null) : null;

  return (
    <article className="group">
      <Link
        href={`/watch/${v.id}${profileId ? `?profileId=${profileId}` : ""}`}
        className="relative block aspect-video overflow-hidden rounded-lg bg-panel ring-1 ring-transparent transition group-hover:ring-brand"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE}/api/thumb/${v.id}`}
          alt={v.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {hover && (
          <video
            src={`${BASE}/api/file/${v.id}`}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {!hover && (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/90 text-ink">
              <Play size={22} fill="currentColor" />
            </span>
          )}
        </span>
        {quality && (
          <span className="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-ink">
            {quality}
          </span>
        )}
        {v.duration ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold">
            {formatDuration(v.duration)}
          </span>
        ) : null}
      </Link>

      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
        <Link href={`/watch/${v.id}${profileId ? `?profileId=${profileId}` : ""}`} className="hover:text-brand">
          {v.title}
        </Link>
      </h3>

      <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted">
        <UserRound size={12} className="shrink-0" />
        {v.profiles.length === 0 ? (
          <span className="italic">Profil yok</span>
        ) : (
          v.profiles.map((p, i) => (
            <span key={p.id}>
              <Link href={`/profiles/${p.id}`} className="hover:text-brand">
                {p.name}
              </Link>
              {i < v.profiles.length - 1 ? "," : ""}
            </span>
          ))
        )}
      </p>
      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <Eye size={12} /> {formatViews(v.views)}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} /> {timeAgo(new Date(v.createdAt))}
        </span>
      </p>
    </article>
  );
}
