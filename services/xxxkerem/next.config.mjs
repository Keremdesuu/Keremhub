import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  reactStrictMode: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  serverExternalPackages: ["sharp", "@prisma/client"],
  webpack(cfg) {
    cfg.resolve.alias["@"] = root;
    return cfg;
  },
};

export default config;
