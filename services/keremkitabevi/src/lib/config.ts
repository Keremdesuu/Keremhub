import path from "node:path";

export const LIBRARY_DIR = process.env.LIBRARY_DIR ?? "/mnt/hdd/keremkitabevi";
export const DATA_DIR = path.resolve(process.cwd(), "data");
export const COVERS_DIR = path.join(DATA_DIR, "covers");
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremkitabevi";
export const LAYOUT = (process.env.LIBRARY_LAYOUT ?? "auto") as
  | "auto"
  | "author-series"
  | "genre-author"
  | "flat";
export const PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 75, 100] as const;
