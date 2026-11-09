import path from "node:path";

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? "./media");
export const THUMB_DIR = path.resolve(process.env.THUMB_DIR ?? "./data/thumbs");

export const PHOTO_DIR = path.resolve(process.env.PHOTO_DIR ?? path.join(MEDIA_DIR, "Fotoğraflar"));
export const VIDEO_DIR = path.resolve(process.env.VIDEO_DIR ?? path.join(MEDIA_DIR, "Videolar"));
// Retain support for legacy @uploads paths; new uploads use library-relative paths.
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? PHOTO_DIR);
export const PROFILE_DIR = path.resolve(process.env.PROFILE_DIR ?? path.join(MEDIA_DIR, "Profil"));
export const PROFILE_PREFIX = "@profil/";

export const UPLOAD_PREFIX = "@uploads/";

/** Veritabanındaki göreli yolu diskteki gerçek yola çevirir (klasör dışına çıkmayı engeller). */
export function resolveMediaFile(rel: string): string | null {
  const [root, sub] = rel.startsWith(PROFILE_PREFIX)
    ? [PROFILE_DIR, rel.slice(PROFILE_PREFIX.length)]
    : rel.startsWith(UPLOAD_PREFIX)
    ? [UPLOAD_DIR, rel.slice(UPLOAD_PREFIX.length)]
    : [MEDIA_DIR, rel];
  const abs = path.resolve(root, sub);
  return abs.startsWith(root + path.sep) ? abs : null;
}

export const VIDEO_EXT = new Set([".mp4", ".m4v", ".webm", ".mkv", ".mov", ".avi"]);
export const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export const PAGE_SIZE = 24;
