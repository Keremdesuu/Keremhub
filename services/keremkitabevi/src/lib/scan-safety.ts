import { execFileSync } from "node:child_process";
import path from "node:path";
export function requireLibraryMount(root: string) {
  const absolute = path.resolve(root);
  if (absolute === "/mnt/hdd" || absolute.startsWith("/mnt/hdd/")) {
    try { execFileSync("/usr/bin/mountpoint", ["-q", "/mnt/hdd"], { stdio: "ignore" }); }
    catch { throw new Error("HDD bağlı değil; tarama ve kayıt silme iptal edildi."); }
  }
}
