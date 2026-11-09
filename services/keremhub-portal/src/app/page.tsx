import { Portal } from "@/components/Portal";
import { siteleriListele } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Sayfa() {
  const siteler = await siteleriListele();
  return <Portal baslangic={siteler} />;
}
