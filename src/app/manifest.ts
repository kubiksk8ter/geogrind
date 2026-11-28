import type { MetadataRoute } from "next";
import { APP_NAME } from "@/config";

// The page background behind the map (Tailwind neutral-200), shown while the installed app starts.
const START_BACKGROUND = "#e5e5e5";

// Shared by both languages: it holds no translatable text, and the start address "/" picks the
// language like any other visit to it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: START_BACKGROUND,
    // "any" icons keep the rounded artwork; the maskable one is full-bleed, so a system that crops
    // it to a circle or another shape keeps the whole "G".
    icons: [
      {
        src: "/icons/geogrind-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/geogrind-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/geogrind-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
