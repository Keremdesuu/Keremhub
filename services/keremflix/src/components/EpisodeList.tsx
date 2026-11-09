"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EpisodeDTO } from "@/lib/queries";
import { PlayIcon, QualityBadge } from "./Icons";

export function EpisodeList({ episodes }: { episodes: EpisodeDTO[] }) {
  const seasons = useMemo(() => [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b), [episodes]);
  const [season, setSeason] = useState(seasons[0] ?? 1);
  const list = episodes.filter((e) => e.season === season);

  return (
    <section className="px-[4vw] pt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="m-title3">Bölümler</h2>
        {seasons.length > 1 && (
          <select value={season} onChange={(e) => setSeason(Number(e.target.value))} className="m-body rounded-md border border-white/30 bg-ink-600 px-3 py-1.5 outline-none">
            {seasons.map((s) => <option key={s} value={s}>{s}. Sezon</option>)}
          </select>
        )}
      </div>
      <ol className="divide-y divide-white/10 border-y border-white/10">
        {list.map((e) => {
          const pct = e.duration > 0 ? Math.min(100, (e.seconds / e.duration) * 100) : 0;
          return (
            <li key={e.id}>
              <Link href={`/watch/${e.id}`} className="group flex items-center gap-5 px-4 py-4 transition hover:bg-white/5">
                <span className="m-title3 w-10 flex-none text-center text-gray-300">{e.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="m-body truncate">{e.name || `${e.number}. Bölüm`}</p>
                  {pct > 0 && (
                    <div className="mt-2 h-1 w-48 max-w-full rounded bg-white/20"><div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} /></div>
                  )}
                </div>
                {e.quality && <QualityBadge label={e.quality.replace("+HDR", "")} />}
                <span className="icon-btn opacity-0 transition group-hover:opacity-100"><PlayIcon size={18} /></span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
