"use client";

import { AnchorProvider, TOCItem, useActiveAnchor } from "fumadocs-core/toc";
import type { TableOfContents, TOCItemType } from "fumadocs-core/toc";
import type { ComponentProps, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

interface DocsTocProps {
  readonly toc: TableOfContents;
}

// TOCItem only emits `data-active` — a styling hook, invisible to assistive
// tech. Mirror it as `aria-current` so the active heading is announced.
// Must render inside an `AnchorProvider`.
export const TocLink = ({
  item,
  ...props
}: Omit<ComponentProps<typeof TOCItem>, "href"> & {
  readonly item: TOCItemType;
}) => {
  const active = useActiveAnchor();
  return (
    <TOCItem
      aria-current={item.url.slice(1) === active ? "location" : undefined}
      href={item.url}
      {...props}
    >
      {item.title}
    </TOCItem>
  );
};

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
      className="bg-foreground absolute -inset-px w-px transition-[transform,height] duration-200 ease-[var(--ease-out)]"
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
          className="text-muted-foreground mb-3 text-xs font-medium tracking-wider uppercase"
          id="toc-heading"
        >
          On this page
        </p>
        <AnchorProvider toc={toc}>
          <nav
            aria-labelledby="toc-heading"
            // dark:border-input (15% vs the default 10% white): the rail is
            // the track the active-heading thumb slides on, so it needs to
            // read as a line, not vanish into the background.
            className="dark:border-input relative flex flex-col gap-0.5 border-s border-dashed ps-4"
            ref={navRef}
          >
            <TocThumb containerRef={navRef} />
            {toc.map((item) => (
              <TocLink
                className="text-muted-foreground hover:text-foreground data-[active=true]:text-foreground py-1 text-sm"
                item={item}
                key={item.url}
                style={{
                  paddingInlineStart: `${Math.max(0, item.depth - 2) * 0.75}rem`,
                }}
              />
            ))}
          </nav>
        </AnchorProvider>
      </div>
    </aside>
  );
};
