import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

// cached forever
export const revalidate = false;

export const GET = async () => {
  const pages = source
    .getPages()
    .toSorted((a, b) => a.url.localeCompare(b.url));
  const rendered = await Promise.all(pages.map(getLLMText));
  const text = rendered.join("\n\n");

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
