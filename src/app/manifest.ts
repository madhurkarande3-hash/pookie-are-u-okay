import type { MetadataRoute } from "next";
import { THEMES } from "@/lib/theme/tokens";

/** Lets people add Pookie to their phone's Home Screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pookie — A little care, a lot of love",
    short_name: "Pookie",
    description: "A gentle companion for older adults: check-ins, medicine reminders, a Care Circle and a LifeBook of memories.",
    start_url: "/",
    display: "standalone",
    background_color: THEMES.sweet.bg,
    theme_color: THEMES.sweet.bg,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
