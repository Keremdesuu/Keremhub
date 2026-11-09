import path from "node:path";

export const config = {
  mediaRoot: process.env.MEDIA_ROOT ?? "/mnt/keremhub/keremflix",
  // Klasör adları (MEDIA_ROOT altında)
  folders: {
    SERIES: process.env.FOLDER_SERIES ?? "diziler",
    MOVIE: process.env.FOLDER_MOVIES ?? "filmler",
    ANIME: process.env.FOLDER_ANIME ?? "animeler",
  },
  tmdbKey: process.env.TMDB_API_KEY ?? "",
  lang: process.env.METADATA_LANG ?? "tr-TR",
  videoExt: [".mp4", ".m4v", ".webm", ".mkv", ".avi", ".mov", ".ts"],
};

export function kindFolder(kind: "SERIES" | "MOVIE" | "ANIME") {
  return path.join(/*turbopackIgnore: true*/ config.mediaRoot, config.folders[kind]);
}
