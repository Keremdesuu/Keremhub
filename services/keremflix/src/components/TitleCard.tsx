import {artworkUrl} from "@/lib/artwork-url";
import {MediaArtwork} from "./MediaArtwork";
import Link from "next/link";
import type { TitleDTO } from "@/lib/queries";
import { ChevronDownIcon, PlayIcon, QualityBadge } from "./Icons";
import { ListButton } from "./ListButton";

function Meta({ t }: { t: TitleDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {t.certification && <span className="cert-badge !text-[11px] !leading-4">{t.certification}</span>}
      {t.year && <span className="r-caption1 text-gray-200">{t.year}</span>}
      {t.seasons > 1 && <span className="r-caption1 text-gray-200">{t.seasons} Sezon</span>}
      {t.quality && <QualityBadge label={t.quality.replace("+HDR", "")} />}
    </div>
  );
}

export function PosterFallback({ title }: { title: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-ink-500 to-ink-700 p-3 text-center">
      <span className="m-body text-gray-200">{title}</span>
    </div>
  );
}

/** Yatay kart: görsel + hover'da altta açılan eylem paneli. */
export function TitleCard({ t, width }: { t: TitleDTO; width?: number | string }) {
  const anime=t.kind==="ANIME";
  const img = t.backdropUrl || t.posterUrl ? artworkUrl(t,anime&&t.posterUrl?"poster":"card") : null;
  const playId = t.resumeEpisodeId ?? t.firstEpisodeId;
  return (
    <article className={`group relative ${anime?"aspect-[2/3]":"aspect-video"} overflow-hidden rounded-lg bg-ink-600 shadow-md ring-1 ring-white/5 transition duration-200 hover:-translate-y-1 hover:ring-2 hover:ring-white/70 focus-within:ring-2 focus-within:ring-white/70`} style={{ width:width??(anime?180:280) }}>
      <Link href={`/title/${t.id}`} className="absolute inset-0" aria-label={t.title}>
        {img ? <MediaArtwork src={img} title={t.title} className={`h-full w-full ${anime?"object-contain":"object-cover"} object-center`} /> : <PosterFallback title={t.title} />}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent" />
        <h3 className={`m-smallbody absolute ${t.isNew ? "bottom-7" : "bottom-2"} left-3 right-3 truncate transition group-hover:opacity-0`}>{t.title}</h3>
        {t.isNew && <span className="m-caption2 absolute bottom-0 left-0 rounded-tr bg-brand px-2 py-0.5 transition group-hover:opacity-0">Yeni Eklendi</span>}
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink-700/95 p-3 opacity-0 backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="pointer-events-auto flex items-center gap-2">
          {playId && (
            <Link href={`/watch/${playId}`} title="Oynat" aria-label="Oynat" className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:bg-gray-100">
              <PlayIcon size={20} />
            </Link>
          )}
          <ListButton titleId={t.id} initial={t.inList} size={36} />
          <Link href={`/title/${t.id}`} title="Ayrıntılar" aria-label="Ayrıntılar" className="icon-btn ml-auto" style={{ width: 36, height: 36 }}>
            <ChevronDownIcon size={20} />
          </Link>
        </div>
        <div className="mt-2 truncate"><span className="m-smallbody">{t.title}</span></div>
        <div className="mt-1"><Meta t={t} /></div>
      </div>

      {t.progress !== null && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
          <div className="h-full bg-brand" style={{ width: `${Math.round(t.progress * 100)}%` }} />
        </div>
      )}
    </article>
  );
}

/** Dikey poster + dev dış çizgili sıra numarası (En İyi 10 satırı). */
export function RankCard({ t, rank }: { t: TitleDTO; rank: number }) {
  return (
    <Link href={`/title/${t.id}`} className="group relative flex h-[190px] items-end" style={{ width: rank >= 10 ? 270 : 220 }} aria-label={`${rank}. ${t.title}`}>
      <span
        className="logo absolute bottom-0 left-0 select-none text-[190px] leading-[0.8] text-transparent"
        style={{ WebkitTextStroke: "3px #595959" }}
      >
        {rank}
      </span>
      <div className="relative ml-auto h-full w-[128px] overflow-hidden rounded-md bg-ink-600 transition duration-200 group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-white/70">
        {t.posterUrl ? <MediaArtwork src={artworkUrl(t,"poster")} title={t.title} className="h-full w-full object-contain" /> : <PosterFallback title={t.title} />}
      </div>
    </Link>
  );
}
