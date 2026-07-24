"use client";

import type {
  Node as PageTreeNode,
  Root as PageTreeRoot,
} from "fumadocs-core/page-tree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Every page-tree node carries a stable `$id`; pages also have a unique
// `url`. Prefer those over the array index so keys survive reordering.
const nodeKey = (node: PageTreeNode): string =>
  node.$id ?? ("url" in node ? node.url : String(node.name));

interface DocsSidebarProps {
  readonly tree: PageTreeRoot;
}

interface SidebarNodeProps {
  readonly node: PageTreeNode;
  readonly pathname: string;
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
    className={cn(
      "block rounded-lg px-3 py-1.5 text-sm transition-colors",
      active
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    )}
    href={href}
  >
    {children}
  </Link>
);

const SidebarNode = ({ node, pathname }: SidebarNodeProps) => {
  if (node.type === "separator") {
    return null;
  }

  if (node.type === "folder") {
    return (
      <div className="mt-6 first:mt-0">
        <p className="px-3 pb-1.5 font-medium text-[0.6875rem] text-muted-foreground uppercase tracking-wider">
          {node.name}
        </p>
        <div className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <SidebarNode
              key={nodeKey(child)}
              node={child}
              pathname={pathname}
            />
          ))}
        </div>
      </div>
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

  return (
    <nav className="flex flex-col gap-1">
      {tree.children.map((node) => (
        <SidebarNode key={nodeKey(node)} node={node} pathname={pathname} />
      ))}
    </nav>
  );
};
