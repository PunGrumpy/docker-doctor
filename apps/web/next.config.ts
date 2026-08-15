import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 95],
    remotePatterns: [
      // GitHub org/user avatars on the leaderboard
      { hostname: "github.com", pathname: "/*.png", protocol: "https" },
    ],
  },

  rewrites: () => [
    {
      destination: "/llms.mdx/docs/:path*",
      source: "/docs/:path*.md",
    },
  ],
};

export default withMDX(nextConfig);
