import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kerem Kitabevi",
    short_name: "Kitabevi",
    description: "Evdeki e-kitap arşivi",
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#0c1022",
    theme_color: "#0c1022",
    icons: [
      { src: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${BASE_PATH}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
