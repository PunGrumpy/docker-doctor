import type { MetadataRoute } from "next";

import { source } from "@/lib/source";
import { url } from "@/lib/url";

export const revalidate = false;

const sitemap = (): MetadataRoute.Sitemap => {
  const pages: MetadataRoute.Sitemap = [];

  for (const page of source.getPages()) {
    const data = page.data as {
      lastModified?: Date;
    };

    pages.push({
      changeFrequency: "weekly" as const,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
      priority: 0.5,
      url: new URL(page.url, url).toString(),
    });
  }

  return [
    {
      changeFrequency: "monthly",
      priority: 1,
      url: new URL("/", url).toString(),
    },
    {
      changeFrequency: "monthly",
      priority: 0.8,
      url: new URL("/leaderboard", url).toString(),
    },
    ...pages,
  ];
};

export default sitemap;
