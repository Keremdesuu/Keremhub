import {artworkUrl} from "@/lib/artwork-url";
import {HeroArtwork} from "@/components/HeroArtwork";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_LABEL, titleDetail, topRated } from "@/lib/queries";
import { ArrowLeftIcon, PlayIcon, QualityBadge } from "@/components/Icons";
import { TitleActions } from "@/components/TitleActions";
import { ListButton } from "@/components/ListButton";
import { EpisodeList } from "@/components/EpisodeList";
import { Row } from "@/components/Row";
import { TitleCard } from "@/components/TitleCard";

export const dynamic = "force-dynamic";

function Facts({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <p className="r-smallbody leading-6">
      <span className="text-gray-300">{label}: </span>
      <span className="text-gray-100">{items.join(", ")}</span>
    </p>
  );
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await titleDetail(Number(id));
  if (!data) notFound();
  const { title: t, episodes, similar } = data;
  const top = await topRated(t.kind, 10);
  const rank = top.findIndex((x) => x.id === t.id) + 1;
  const playId = t.resumeEpisodeId ?? t.firstEpisodeId;
  const img = t.backdropUrl || t.posterUrl ? artworkUrl(t,"hero") : null;
  const hdr = t.quality?.includes("HDR");

  return (
    <div className="pb-16">
      <section className="relative isolate flex min-h-[56vh] items-end overflow-hidden">
        {img && <HeroArtwork src={img} posterSrc={t.kind==="ANIME"&&t.posterUrl?artworkUrl(t,"poster"):undefined}/>}
        <Link href={`/${t.kind === "SERIES" ? "dizi" : t.kind === "MOVIE" ? "film" : "anime"}`} className="m-body absolute z-10 left-[4vw] top-28 lg:top-20 inline-flex items-center gap-2 text-gray-100 hover:text-white">
          <ArrowLeftIcon size={22} /> {KIND_LABEL[t.kind]}
        </Link>
        <div className="fade-in relative z-10 w-full px-[4vw] pb-8 pt-[calc(56.25vw+6.5rem)] lg:pt-32">
          <h1 className="text-3xl font-bold sm:text-4xl max-w-[800px] leading-[1.02] md:b-largetitle">{t.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {playId && (
              <Link href={`/watch/${playId}`} className="m-headline2 inline-flex items-center gap-2 rounded-md bg-white px-7 py-2.5 text-black transition hover:bg-white/80">
                <PlayIcon size={28} /> {t.resumeEpisodeId ? "Devam Et" : "Oynat"}
              </Link>
            )}
            <ListButton titleId={t.id} initial={t.inList} size={46} />
          </div>
          <TitleActions titleId={t.id} title={t.title} isMovie={t.kind === "MOVIE"} />
        </div>
      </section>

      {/* Ayrıntı deseni: sol sütun özet, sağ sütun künye */}
      <section className="grid gap-10 px-[4vw] pt-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {t.isNew && <span className="m-body text-green">Yeni</span>}
            {t.kind !== "MOVIE" && t.seasons > 0 && <span className="r-body text-gray-200">{t.seasons} Sezon</span>}
            {t.kind !== "MOVIE" && <span className="r-body text-gray-200">{t.episodeCount} Bölüm</span>}
            {t.kind === "MOVIE" && t.runtime ? <span className="r-body text-gray-200">{Math.floor(t.runtime / 60)} sa {t.runtime % 60} dk</span> : null}
            {t.year && <span className="r-body text-gray-200">{t.year}</span>}
            {t.quality && <QualityBadge label={t.quality.replace("+HDR", "")} />}
            {hdr && <QualityBadge label="HDR" />}
          </div>
          {t.certification && (
            <div className="mt-3"><span className="cert-badge">{t.certification}</span></div>
          )}
          {rank > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <span className="m-caption2 grid h-9 w-9 place-items-center rounded bg-brand leading-[1] text-center">TOP<br />10</span>
              <span className="m-headline2">{KIND_LABEL[t.kind]} kategorisinde #{rank}</span>
            </div>
          )}
          {t.rating ? <p className="r-body mt-3 text-gray-200">Puan: <span className="m-body text-white">{t.rating.toFixed(1)}</span> / 10</p> : null}
          <p className="r-headline1 mt-5 max-w-[720px] leading-7 text-gray-100">
            {t.overview ?? "Bu başlık için henüz özet bulunamadı."}
          </p>
        </div>
        <aside className="space-y-2 md:pt-1">
          <Facts label="Oyuncular" items={t.cast} />
          <Facts label="Türler" items={t.genres} />
          <Facts label="Bu yapım" items={t.moods} />
        </aside>
      </section>

      {t.kind !== "MOVIE" && <EpisodeList episodes={episodes} />}

      {similar.length > 0 && (
        <div className="pt-10">
          <Row title="Benzer Yapımlar">{similar.map((s) => <TitleCard key={s.id} t={s} />)}</Row>
        </div>
      )}
    </div>
  );
}
