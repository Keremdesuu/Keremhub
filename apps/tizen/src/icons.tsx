import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  play: "m8 5 12 7-12 7Z",
  pause: "M8 5v14M16 5v14",
  back: "m15 5-7 7 7 7",
  close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 4v16M4 12h16",
  check: "m4 12 5 5L20 6",
  info: "M12 11v6M12 7v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  next: "m5 5 12 7-12 7ZM20 5v14",
  chevron: "m9 5 7 7-7 7",
  rewind: "M5 8a9 9 0 1 1-1 8M5 2v6h6",
  forward: "M19 8a9 9 0 1 0 1 8M19 2v6h-6",
  volume: "m3 9 4 0 5-5v16l-5-5H3ZM16 8q5 4 0 8M19 5q8 7 0 14",
  mute: "m3 9 4 0 5-5v16l-5-5H3ZM17 9l5 6M22 9l-5 6",
  subtitles: "M3 4h18v13h-6l-3 4-3-4H3ZM7 9h4M14 9h3M7 13h10",
  episodes: "M3 5h18v14H3ZM7 2h12M7 9h10M7 13h7",
  speed: "M4 19a10 10 0 1 1 16 0M12 12l5-5M12 12v4",
  expand: "M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z",
  thumb: "M7 10v11H3V10ZM7 10l6-8h2v7h6l-2 12H7",
  home: "m2 11 10-8 10 8M5 9v12h14V9",
  retry: "M20 8a9 9 0 1 0 1 8M20 2v6h-6",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
export function Icon({
  name,
  size = 28,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" || name === "next" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}
