import "dotenv/config";
import { scanLibrary } from "../src/lib/scanner";

const refetch = process.argv.includes("--refetch");
scanLibrary({ refetchMissing: refetch, log: (m) => console.log(m) })
  .then((r) => {
    console.log("\nTarama tamamlandı:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
