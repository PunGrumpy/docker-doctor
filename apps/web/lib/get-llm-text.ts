import type { InferPageType } from "fumadocs-core/source";

import type { source } from "@/lib/source";

// Renders a single docs page as clean Markdown for AI answer engines: a title
// heading, the canonical URL, then the processed page body. `getText` is
// available because `includeProcessedMarkdown` is enabled in source.config.ts.
export const getLLMText = async (
  page: InferPageType<typeof source>
): Promise<string> => {
  const processed = await page.data.getText("processed");
  return `# ${page.data.title}\nURL: ${page.url}\n\n${processed}`;
};
