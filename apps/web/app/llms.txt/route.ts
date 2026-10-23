import { llms } from "fumadocs-core/source/llms";

import { source } from "@/lib/source";

export const revalidate = false;

const serveLlmsIndex = () =>
  new Response(llms(source).index(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export { serveLlmsIndex as GET };
