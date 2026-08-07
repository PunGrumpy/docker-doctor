import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 95],
  },

  rewrites: () => [
    {
      destination: "/llms.mdx/docs/:path*",
      source: "/docs/:path*.md",
    },
    {
      destination: "https://us-assets.i.posthog.com/static/:path*",
      source: "/ingest/static/:path*",
    },
    {
      destination: "https://us.i.posthog.com/:path*",
      source: "/ingest/:path*",
    },
  ],

  skipTrailingSlashRedirect: true,
};

export default withMDX(nextConfig);
