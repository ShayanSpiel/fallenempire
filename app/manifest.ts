import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eIntelligence",
    short_name: "eIntelligence",
    description: "A social simulation prototype for strategy, community, and AI-driven play.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff9f0",
    theme_color: "#facc15",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  }
}

