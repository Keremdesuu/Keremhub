import { removePhotoPreviews } from "./photo-preview";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { MEDIA_DIR, UPLOAD_DIR, PROFILE_DIR, THUMB_DIR, UPLOAD_PREFIX, PROFILE_PREFIX, resolveMediaFile } from "./config";
import { requireLibraryMount } from "./scan-safety";

// Validate every target before unlinking anything; never follow a path outside its storage root.
async function target(rel: string) {
  const root = rel.startsWith(PROFILE_PREFIX) ? PROFILE_DIR : rel.startsWith(UPLOAD_PREFIX) ? UPLOAD_DIR : MEDIA_DIR;
  requireLibraryMount(root);
  const file = resolveMediaFile(rel);
  if (!file) throw new Error("Geçersiz dosya yolu");
  await validate(root, file);
  return file;
}
async function validate(root: string, file: string) {
  const realRoot = await fs.realpath(root);
  const parent = await fs.realpath(path.dirname(file));
  if (parent !== realRoot && !parent.startsWith(realRoot + path.sep)) throw new Error("Dosya izin verilen klasörün dışında");
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile()) throw new Error("Dosya normal bir medya dosyası değil");
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
}
export async function deleteMedia(id: number) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return false;
  const files = [await target(media.path)];
  if (media.avatarFile) files.push(await target(media.avatarFile));
  const thumb = path.join(THUMB_DIR, `${id}.jpg`);
  await validate(THUMB_DIR, thumb);
  files.push(thumb);
  for (const file of new Set(files)) {
    try { await fs.unlink(file); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  await removePhotoPreviews(id);
  await prisma.$transaction([
    prisma.profile.updateMany({ where: { avatarMediaId: id }, data: { avatarMediaId: null } }),
    prisma.media.delete({ where: { id } }),
  ]);
  return true;
}
