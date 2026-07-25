import { notFound } from "next/navigation";

import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const revalidate = false;

export const generateStaticParams = () => source.generateParams();

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) => {
  const { slug } = await params;
  const page = source.getPage(slug);

  if (!page) {
    notFound();
  }

  return new Response(await getLLMText(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
