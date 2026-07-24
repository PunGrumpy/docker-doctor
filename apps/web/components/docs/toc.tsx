"use client";

import { AnchorProvider, TOCItem, useActiveAnchor } from "fumadocs-core/toc";
import type { TableOfContents } from "fumadocs-core/toc";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

interface DocsTocProps {
  readonly toc: TableOfContents;
}

interface ThumbPosition {
  readonly top: number;
  readonly height: number;
}

// A solid marker that slides along the dashed rail to track the active
// heading. It reads the active `TOCItem` anchor's offset within the nav (which
// is `position: relative`), so it stays aligned regardless of item depth.
const TocThumb = ({
  containerRef,
}: {
  readonly containerRef: RefObject<HTMLElement | null>;
}) => {
  const active = useActiveAnchor();
  const [position, setPosition] = useState<ThumbPosition | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!(container && active)) {
      setPosition(null);
      return;
    }

    const measure = () => {
      const link = container.querySelector<HTMLElement>(
        `a[href="#${CSS.escape(active)}"]`
      );
      setPosition(
        link ? { height: link.offsetHeight, top: link.offsetTop } : null
      );
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, containerRef]);

  if (!position) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute -inset-px w-px bg-foreground transition-[transform,height] duration-200 ease-[var(--ease-out)]"
      style={{
        height: position.height,
        transform: `translateY(${position.top}px)`,
      }}
    />
  );
};

export const DocsToc = ({ toc }: DocsTocProps) => {
  const navRef = useRef<HTMLElement | null>(null);

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
            className="relative flex flex-col gap-0.5 border-s border-dashed ps-4"
            ref={navRef}
          >
            <TocThumb containerRef={navRef} />
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
