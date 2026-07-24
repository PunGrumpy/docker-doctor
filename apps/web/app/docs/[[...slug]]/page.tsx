import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsMobileToc } from "@/components/docs/mobile-toc";
import { DocsToc } from "@/components/docs/toc";
import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

interface DocPageProps {
  readonly params: Promise<{ slug?: string[] }>;
}

export const generateStaticParams = () => source.generateParams();

export const generateMetadata = async ({
  params,
}: DocPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  return {
    description: page.data.description,
    title: page.data.title,
  };
};

const Page = async ({ params }: DocPageProps) => {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  const MdxContent = page.data.body;

  return (
    <div className="flex gap-12">
      <article className="min-w-0 max-w-3xl flex-1">
        <h1 className="font-serif text-4xl font-normal tracking-tight">
          {page.data.title}
        </h1>
        {page.data.description ? (
          <p className="mt-2 text-muted-foreground">{page.data.description}</p>
        ) : null}
        <DocsMobileToc toc={page.data.toc} />
        <div className="mt-8">
          <MdxContent components={getMDXComponents()} />
        </div>
      </article>
      <DocsToc toc={page.data.toc} />
    </div>
  );
};

export default Page;
