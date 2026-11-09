import { NextResponse } from "next/server";
import os from "node:os";
import fs from "node:fs/promises";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cpuSample() {
  return os.cpus().reduce((all, c) => ({ idle: all.idle + c.times.idle, total: all.total + Object.values(c.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
}
let previous = cpuSample();
let sampled = Date.now();
let cpuPercent: number | null = null;
function cpuUsage() {
  if (Date.now() - sampled < 1000) return cpuPercent;
  const next = cpuSample(), total = next.total - previous.total;
  if (total > 0) cpuPercent = Math.round(Math.max(0, Math.min(100, (1 - (next.idle - previous.idle) / total) * 100)));
  previous = next; sampled = Date.now(); return cpuPercent;
}
async function temperature() {
  try { const n = Number(await fs.readFile("/sys/class/thermal/thermal_zone0/temp", "utf8")); return Number.isFinite(n) && n > 0 ? Math.round(n / 100) / 10 : null; } catch { return null; }
}
async function availableMemory() {
  try { const match = /MemAvailable:\s+(\d+)/.exec(await fs.readFile("/proc/meminfo", "utf8")); if (match) return Number(match[1]) * 1024; } catch {}
  return os.freemem();
}
async function model() { try { return (await fs.readFile("/proc/device-tree/model", "utf8")).replace(/\0/g, "").trim(); } catch { return "Raspberry Pi"; } }
async function disks() {
  const results: { ad: string; toplam: number; bos: number }[] = [];
  for (const entry of (process.env.DISK_PATHS ?? "Sistem=/").split(",")) {
    const [ad, path] = entry.split("=").map(x => x.trim()); if (!ad || !path) continue;
    try { if (path.startsWith("/mnt/") || path.startsWith("/media/")) { const [device, root] = await Promise.all([fs.stat(path), fs.stat("/")]); if (device.dev === root.dev) continue; } const s = await fs.statfs(path); if (s.blocks > 0) results.push({ ad, toplam: s.blocks * s.bsize, bos: s.bavail * s.bsize }); } catch {}
  }
  return results;
}
export async function GET() {
  const [sicaklik, bellekBos, diskler, deviceModel] = await Promise.all([temperature(), availableMemory(), disks(), model()]);
  return NextResponse.json({ sicaklik, yuk: os.loadavg()[0], islemciKullanim: cpuUsage(), cekirdek: os.cpus().length, bellekToplam: os.totalmem(), bellekBos, calismaSuresi: os.uptime(), model: deviceModel, diskler }, { headers: { "Cache-Control": "no-store" } });
}
