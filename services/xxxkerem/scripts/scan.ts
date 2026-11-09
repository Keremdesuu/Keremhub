import "dotenv/config";
import { scanLibrary } from "../lib/scan";
import { prisma } from "../lib/prisma";

scanLibrary()
  .then((r) => {
    console.log(`Tarama bitti: ${r.added} eklendi, ${r.removed} kaldırıldı, toplam ${r.total}, hata ${r.errors}`);
  })
  .finally(() => prisma.$disconnect());
