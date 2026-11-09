export function formatDuration(sec?: number | null): string {
  if (!sec || sec < 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}B`;
  return String(n);
}

export function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  const units: [number, string][] = [
    [31536000, "yıl"],
    [2592000, "ay"],
    [604800, "hafta"],
    [86400, "gün"],
    [3600, "saat"],
    [60, "dakika"],
  ];
  for (const [secs, label] of units) {
    if (diff >= secs) return `${Math.floor(diff / secs)} ${label} önce`;
  }
  return "az önce";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr"))
    .join("");
}
