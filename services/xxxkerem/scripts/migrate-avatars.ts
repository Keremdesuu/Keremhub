import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { prepareAvatar } from '../lib/avatar';
async function main() {
 const profiles = await prisma.profile.findMany({ where: { avatarMediaId: { not: null } } });
 let copied = 0, failed = 0, videos = 0;
 for (const p of profiles) {
  const m = await prisma.media.findUnique({ where: { id: p.avatarMediaId! } });
  if (m?.kind !== 'IMAGE') { videos++; continue; }
  try { await prepareAvatar(m.id); copied++; } catch { failed++; }
 }
 console.log({ copied, failed, nonImageAvatars: videos });
 if (failed) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
