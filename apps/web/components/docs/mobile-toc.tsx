"use client";

import { AnchorProvider } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

import { TocLink } from "@/components/docs/toc";

interface DocsMobileTocProps {
  readonly toc: TableOfContents;
}

export const DocsMobileToc = ({ toc }: DocsMobileTocProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  // The panel behaves as a popover (it overlays content), so Escape should
  // dismiss it — native <details> doesn't provide that. Attached natively
  // so it stays off a non-interactive JSX handler.
  useEffect(() => {
    const details = detailsRef.current;
    if (!details) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.open) {
        details.open = false;
        summaryRef.current?.focus();
      }
    };

    details.addEventListener("keydown", onKeyDown);
    return () => details.removeEventListener("keydown", onKeyDown);
  }, []);

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
      <summary
        className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium lg:px-0 [&::-webkit-details-marker]:hidden"
        ref={summaryRef}
      >
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
              <TocLink
                className="text-muted-foreground hover:bg-muted/50 hover:text-foreground data-[active=true]:text-foreground rounded-md py-1.5 text-sm"
                item={item}
                key={item.url}
                onClick={close}
                style={{
                  paddingInlineEnd: "0.5rem",
                  paddingInlineStart: `${0.5 + Math.max(0, item.depth - 2) * 0.75}rem`,
                }}
              />
            ))}
          </nav>
        </AnchorProvider>
      </div>
    </details>
  );
};
