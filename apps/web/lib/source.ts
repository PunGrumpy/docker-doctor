import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const getPageImageUrl = (page: (typeof source)["$inferPage"]) => {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/${[page.locale, "og", "docs", ...segments].filter(Boolean).join("/")}`,
  };
};
