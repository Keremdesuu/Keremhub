import { scanLibrary } from "../src/lib/scanner";

scanLibrary()
  .then((r) => {
    console.log(
      `Tarama bitti (${(r.tookMs / 1000).toFixed(1)} sn): ${r.added} yeni, ${r.updated} güncel, ${r.removed} silinen, ${r.unchanged} değişmeyen`
    );
    for (const e of r.errors) console.warn(`  ! ${e.file}: ${e.message}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
