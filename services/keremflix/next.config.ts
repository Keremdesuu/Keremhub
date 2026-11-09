import type { NextConfig } from "next";

// Alt yol: 192.168.1.240/keremflix. Derleme sırasında .env'den okunur.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremflix";

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  basePath: BASE_PATH || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  poweredByHeader: false,
  serverExternalPackages: ["better-sqlite3", "sharp"],
  images: { remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }, { protocol: "https", hostname: "s4.anilist.co" }] },
};
export default config;
