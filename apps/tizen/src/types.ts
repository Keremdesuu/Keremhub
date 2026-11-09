export type Kind = "MOVIE" | "SERIES" | "ANIME";
export interface Title {
  id: number;
  kind: Kind;
  title: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  cast: string[];
  moods: string[];
  rating: number | null;
  certification: string | null;
  runtime: number | null;
  seasons: number;
  episodeCount: number;
  quality: string | null;
  isNew: boolean;
  inList: boolean;
  progress: number | null;
  resumeEpisodeId: number | null;
  firstEpisodeId: number | null;
  addedAt?: number | string;
}
export interface Episode {
  id: number;
  season: number;
  number: number;
  name: string | null;
  quality: string | null;
  seconds: number;
  duration: number;
}
export interface Detail {
  title: Title;
  episodes: Episode[];
  similar: Title[];
}
export interface Home {
  hero: Title | null;
  continueWatching: Title[];
  recent: Title[];
  topRated: Title[];
  genres: { genre: string; items: Title[] }[];
}
export interface Preferences {
  autoplay: boolean;
  subSize: number;
  subBackground: boolean;
  subPosition: number;
  subDelay: number;
  server: string;
}
export interface Track {
  source?: "server";
  index: number;
  type: string;
  extra_info: string;
}
export interface Cue {
  start: number;
  end: number;
  text: string;
}
declare global {
  interface Window {
    webapis?: any;
    tizen?: any;
    KF_TEST?: boolean;
  }
}
