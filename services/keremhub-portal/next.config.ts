import type { NextConfig } from "next";

const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
