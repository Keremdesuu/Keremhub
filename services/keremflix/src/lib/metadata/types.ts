export interface Meta {
  title: string;
  originalTitle?: string | null;
  year?: number | null;
  overview?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  genres: string[];
  cast: string[];
  moods: string[];
  rating?: number | null; // 0-10
  certification?: string | null;
  runtime?: number | null; // dakika
  tmdbId?: number | null;
  anilistId?: number | null;
}
