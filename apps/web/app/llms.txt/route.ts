import { llms } from "fumadocs-core/source/llms";

import { source } from "@/lib/source";

// cached forever
export const revalidate = false;

export const GET = () =>
  new Response(llms(source).index(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
