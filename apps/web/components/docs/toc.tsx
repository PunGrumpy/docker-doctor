"use client";

import type { TableOfContents } from "fumadocs-core/toc";
import Link from "next/link";

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
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          On this page
        </p>
        <nav className="flex flex-col gap-2 border-s border-dashed ps-4">
          {toc.map((item) => (
            <Link
              className="text-sm text-muted-foreground hover:text-foreground"
              href={item.url}
              key={item.url}
              style={{ paddingInlineStart: `${(item.depth - 2) * 0.75}rem` }}
            >
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
};
