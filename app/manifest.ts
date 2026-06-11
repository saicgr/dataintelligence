import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ByteShards",
    short_name: "ByteShards",
    start_url: "/drill",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f1b2d",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
