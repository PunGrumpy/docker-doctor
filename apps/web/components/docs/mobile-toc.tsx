"use client";

import { AnchorProvider, TOCItem } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";
import { ChevronDown } from "lucide-react";
import { useRef } from "react";

interface DocsMobileTocProps {
  readonly toc: TableOfContents;
}

export const DocsMobileToc = ({ toc }: DocsMobileTocProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  if (toc.length === 0) {
    return null;
  }

  const close = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details
      className="group bg-background sticky top-14 z-20 -mx-4 mt-6 mb-8 border-y border-dashed lg:mx-0 xl:hidden"
      ref={detailsRef}
    >
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium lg:px-0 [&::-webkit-details-marker]:hidden">
        On this page
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground size-4 transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180"
        />
      </summary>
      <div className="animate-in bg-background shadow-custom animation-duration-200 fade-in slide-in-from-top-1 absolute inset-x-0 top-full max-h-[60vh] overflow-y-auto overscroll-contain border-b border-dashed p-2 [--tw-ease:var(--ease-out)]">
        <AnchorProvider toc={toc}>
          <nav aria-label="On this page" className="flex flex-col">
            {toc.map((item) => (
              <TOCItem
                className="text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active=true]:text-foreground rounded-md py-1.5 text-sm"
                href={item.url}
                key={item.url}
                onClick={close}
                style={{
                  paddingInlineEnd: "0.5rem",
                  paddingInlineStart: `${0.5 + Math.max(0, item.depth - 2) * 0.75}rem`,
                }}
              >
                {item.title}
              </TOCItem>
            ))}
          </nav>
        </AnchorProvider>
      </div>
    </details>
  );
};
