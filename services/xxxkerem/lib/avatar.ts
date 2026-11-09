import { requireLibraryMount } from "./scan-safety";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { PROFILE_DIR, PROFILE_PREFIX, resolveMediaFile } from "./config";

export async function prepareAvatar(id: number) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media || media.kind !== "IMAGE") throw new Error("Profil resmi bir fotoğraf olmalı");
  const source = resolveMediaFile(media.avatarFile ?? media.path);
  if (!source) throw new Error("Geçersiz dosya");
  requireLibraryMount(PROFILE_DIR);
  await fs.mkdir(PROFILE_DIR, { recursive: true });
  const name = `${id}${path.extname(source).toLowerCase()}`;
  if (source !== path.join(PROFILE_DIR, name)) await fs.copyFile(source, path.join(PROFILE_DIR, name), 1).catch(async (e) => { if (e.code !== "EEXIST") throw e; });
  await prisma.media.update({ where: { id }, data: { isAvatar: true, avatarFile: PROFILE_PREFIX + name } });
}
