import { notFound } from "next/navigation";
import { episodeForPlayer } from "@/lib/queries";
import { Player } from "@/components/Player";

export const dynamic = "force-dynamic";

export default async function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await episodeForPlayer(Number(id));
  if (!data) notFound();
  const { episode, title, nextId, siblings } = data;
  const isMovie = title.kind === "MOVIE";
  const subtitle = isMovie ? "" : `${episode.season}. Sezon ${episode.number}. Bölüm${episode.name ? ` · ${episode.name}` : ""}`;
  return (
    <Player
      key={episode.id}
      episodeId={episode.id}
      titleId={title.id}
      title={title.title}
      subtitle={subtitle}
      startAt={episode.startAt}
      nextId={nextId}
      episodes={isMovie ? [] : siblings.map((s) => ({ id: s.id, label: `${s.season}x${String(s.number).padStart(2, "0")}${s.name ? ` · ${s.name}` : ""}` }))}
    />
  );
}
