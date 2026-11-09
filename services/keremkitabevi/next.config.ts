import type { NextConfig } from "next";

// Keremhub'ın nginx'i bu siteyi /keremkitabevi/ altında sunar.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/keremkitabevi";

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  basePath,
  reactStrictMode: true,
  ...(process.env.KITABEVI_LOW_MEMORY ? {experimental:{cpus:1,webpackMemoryOptimizations:true,webpackBuildWorker:true,parallelServerCompiles:false,parallelServerBuildTraces:false}} : {}),
  serverExternalPackages: ["better-sqlite3", "sharp", "adm-zip"],
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;
