import Link from "next/link";
import {ChevronRightIcon} from "./Icons";
import { config } from "@/lib/config";
import { byGenre, continueWatching, heroCandidates, kindCount, recent, topRated, KIND_LABEL } from "@/lib/queries";
import type { Kind } from "@/lib/kinds";
import {RotatingHero} from "./RotatingHero";
import { EmptyLibrary } from "./Hero";
import { RankCard, TitleCard } from "./TitleCard";
import { Row } from "./Row";

const PLURAL: Record<Kind, string> = { SERIES: "Diziler", MOVIE: "Filmler", ANIME: "Animeler" };

/** Ana sayfa (kind yok) ve Dizi / Film / Anime sekmeleri için ortak sayfa. */
export async function Browse({ kind }: { kind?: Kind }) {
  const [heroes, cont, fresh, top, genres, total] = await Promise.all([
    heroCandidates(kind),
    continueWatching(kind),
    recent(kind, 20),
    topRated(kind, 10),
    byGenre(kind),
    kind ? kindCount(kind) : Promise.resolve(0),
  ]);

  if (!heroes.length) return <EmptyLibrary root={config.mediaRoot} />;

  const perKind = kind
    ? []
    : await Promise.all((["SERIES", "MOVIE", "ANIME"] as const).map(async (k) => ({ k, items: await recent(k, 20) })));

  return (
    <>
      <RotatingHero candidates={heroes} scope={kind??"all"} />
      <div className="relative z-10 space-y-2 pb-16">
        {kind&&<div className="flex flex-wrap items-center justify-between gap-3 px-[4vw] pb-4">
          <h2 className="m-title3">{PLURAL[kind]}</h2>
          <Link href={`/${kind==="MOVIE"?"film":kind==="SERIES"?"dizi":"anime"}/tumu`} className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-white/15 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Tüm {PLURAL[kind]} <span className="rounded-full bg-black/30 px-2 py-0.5 text-sm text-gray-100">{total}</span><ChevronRightIcon size={20}/>
          </Link>
        </div>}
        {cont.length > 0 && (
          <Row title="İzlemeye Devam Et">{cont.map((t) => <TitleCard key={t.id} t={t} />)}</Row>
        )}
        {fresh.length > 0 && (
          <Row title={kind ? `Yeni Eklenen ${PLURAL[kind]}` : "Yeni Eklenenler"}>{fresh.map((t) => <TitleCard key={t.id} t={t} />)}</Row>
        )}
        {top.length >= 3 && (
          <Row title={kind ? `En Yüksek Puanlı 10 ${KIND_LABEL[kind]}` : "En Yüksek Puanlı 10"}>
            {top.map((t, i) => <RankCard key={t.id} t={t} rank={i + 1} />)}
          </Row>
        )}
        {perKind.filter((p) => p.items.length > 0).map((p) => (
          <Row key={p.k} title={PLURAL[p.k]}>{p.items.map((t) => <TitleCard key={t.id} t={t} />)}</Row>
        ))}
        {genres.map((g) => (
          <Row key={g.genre} title={g.genre}>{g.items.map((t) => <TitleCard key={t.id} t={t} />)}</Row>
        ))}


      </div>
    </>
  );
}
