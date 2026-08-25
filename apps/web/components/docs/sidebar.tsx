"use client";

import type {
  Folder as PageTreeFolder,
  Node as PageTreeNode,
  Root as PageTreeRoot,
} from "fumadocs-core/page-tree";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Every page-tree node carries a stable `$id`; pages also have a unique
// `url`. Prefer those over the array index so keys survive reordering.
const nodeKey = (node: PageTreeNode): string =>
  node.$id ?? ("url" in node ? node.url : String(node.name));

const containsPath = (node: PageTreeFolder, pathname: string): boolean => {
  if (node.index?.url === pathname) {
    return true;
  }
  return node.children.some((child) => {
    if (child.type === "page") {
      return child.url === pathname;
    }
    if (child.type === "folder") {
      return containsPath(child, pathname);
    }
    return false;
  });
};

interface DocsSidebarProps {
  readonly tree: PageTreeRoot;
}

interface SidebarNodeProps {
  readonly node: PageTreeNode;
  readonly pathname: string;
  readonly depth: number;
}

const SidebarLink = ({
  href,
  active,
  children,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly children: ReactNode;
}) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={cn(
      "block rounded-lg px-3 py-1.5 text-sm",
      active
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    )}
    data-active={active ? "true" : undefined}
    href={href}
  >
    {children}
  </Link>
);

const SidebarNode = ({ node, pathname, depth }: SidebarNodeProps) => {
  if (node.type === "separator") {
    return null;
  }

  if (node.type === "folder") {
    const folderChildren = (
      <div className="flex flex-col gap-0.5">
        {node.index ? (
          <SidebarLink
            active={pathname === node.index.url}
            href={node.index.url}
          >
            Overview
          </SidebarLink>
        ) : null}
        {node.children.map((child) => (
          <SidebarNode
            depth={depth + 1}
            key={nodeKey(child)}
            node={child}
            pathname={pathname}
          />
        ))}
      </div>
    );

    if (depth === 0) {
      return (
        <div className="mt-6 first:mt-0">
          <p className="text-muted-foreground px-3 pb-1.5 text-xs font-medium tracking-wider uppercase">
            {node.name}
          </p>
          {folderChildren}
        </div>
      );
    }

    return (
      <details className="group" open={containsPath(node, pathname)}>
        <summary className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
          {node.name}
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180"
          />
        </summary>
        <div className="ms-3 border-s border-dashed ps-3">{folderChildren}</div>
      </details>
    );
  }

  return (
    <SidebarLink active={pathname === node.url} href={node.url}>
      {node.name}
    </SidebarLink>
  );
};

export const DocsSidebar = ({ tree }: DocsSidebarProps) => {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // A deep link can land on an entry far below the sidebar's own scroll.
  useEffect(() => {
    navRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <nav
      aria-label="Documentation"
      className="flex flex-col gap-1"
      ref={navRef}
    >
      {tree.children.map((node) => (
        <SidebarNode
          depth={0}
          key={nodeKey(node)}
          node={node}
          pathname={pathname}
        />
      ))}
    </nav>
  );
};
