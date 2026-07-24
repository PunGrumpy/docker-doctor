"use client";

import { AnchorProvider, TOCItem } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";

interface DocsTocProps {
  readonly toc: TableOfContents;
}

export const DocsToc = ({ toc }: DocsTocProps) => {
  if (toc.length === 0) {
    return null;
  }

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-24">
        <p
          className="mb-3 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wider"
          id="toc-heading"
        >
          On this page
        </p>
        <AnchorProvider toc={toc}>
          <nav
            aria-labelledby="toc-heading"
            className="flex flex-col gap-0.5 border-s border-dashed ps-4"
          >
            {toc.map((item) => (
              <TOCItem
                className="py-1 text-muted-foreground text-sm hover:text-foreground data-[active=true]:text-foreground"
                href={item.url}
                key={item.url}
                style={{
                  paddingInlineStart: `${Math.max(0, item.depth - 2) * 0.75}rem`,
                }}
              >
                {item.title}
              </TOCItem>
            ))}
          </nav>
        </AnchorProvider>
      </div>
    </aside>
  );
};
