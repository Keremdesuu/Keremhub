import {artworkUrl} from "@/lib/artwork-url";
import {HeroArtwork} from "@/components/HeroArtwork";
import Link from "next/link";
import type { TitleDTO } from "@/lib/queries";
import { KIND_LABEL } from "@/lib/kinds";
import { InfoIcon, PlayIcon, QualityBadge } from "./Icons";
import { ListButton } from "./ListButton";

export function Hero({ t }: { t: TitleDTO }) {
  const playId = t.resumeEpisodeId ?? t.firstEpisodeId;
  const img = t.backdropUrl || t.posterUrl ? artworkUrl(t,"hero") : null;
  return (
    <section className="relative isolate -mb-20 flex min-h-[78vh] items-end overflow-hidden">
      {img && <HeroArtwork src={img} posterSrc={t.kind==="ANIME"&&t.posterUrl?artworkUrl(t,"poster"):undefined}/>}

      <div className="fade-in relative z-10 w-full px-[4vw] pb-28 pt-[calc(56.25vw+6.5rem)] lg:pb-40 lg:pt-32">
        <div className="mb-3 flex items-center gap-2">
          <span className="logo text-[22px]">K</span>
          <span className="m-caption1 tracking-[0.35em] text-gray-100">{KIND_LABEL[t.kind].toUpperCase()}</span>
        </div>
        <h1 className="text-3xl font-bold sm:text-4xl max-w-[760px] leading-[1.02] md:b-largetitle md:!leading-[1]">{t.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {t.isNew && <span className="m-body text-green">Yeni</span>}
          {t.rating ? <span className="m-body text-green">%{Math.round(t.rating * 10)} eşleşme</span> : null}
          {t.year && <span className="r-body text-gray-100">{t.year}</span>}
          {t.seasons > 1 && <span className="r-body text-gray-100">{t.seasons} Sezon</span>}
          {t.certification && <span className="cert-badge">{t.certification}</span>}
          {t.quality && <QualityBadge label={t.quality.replace("+HDR", "")} />}
          {t.quality?.includes("HDR") && <QualityBadge label="HDR" />}
        </div>

        {t.overview && <p className="r-headline1 mt-4 line-clamp-3 max-w-[560px] text-gray-100 drop-shadow">{t.overview}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {playId && (
            <Link href={`/watch/${playId}`} className="m-headline2 inline-flex items-center gap-2 rounded-md bg-white px-7 py-2.5 text-black transition hover:bg-white/80">
              <PlayIcon size={28} /> {t.resumeEpisodeId ? "Devam Et" : "Oynat"}
            </Link>
          )}
          <Link href={`/title/${t.id}`} className="m-headline2 inline-flex items-center gap-2 rounded-md bg-glass px-6 py-2.5 backdrop-blur transition hover:bg-glass-strong">
            <InfoIcon size={26} /> Daha Fazla Bilgi
          </Link>
          <ListButton titleId={t.id} initial={t.inList} size={46} />
        </div>
      </div>
    </section>
  );
}

export function EmptyLibrary({ root }: { root: string }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-[4vw] text-center">
      <div className="max-w-xl">
        <p className="logo text-[64px]">KEREMFLIX</p>
        <h2 className="m-title3 mt-4">Kütüphane henüz boş</h2>
        <p className="r-body mt-3 text-gray-200">
          <code className="rounded bg-ink-600 px-2 py-0.5">{root}</code> altındaki <b>diziler</b>, <b>filmler</b> ve <b>animeler</b> klasörlerine içerik ekle,
          sonra sağ üstteki zil simgesine tıklayarak kütüphaneyi tara.
        </p>
      </div>
    </div>
  );
}
