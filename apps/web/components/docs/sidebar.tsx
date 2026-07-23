"use client";

import type {
  Node as PageTreeNode,
  Root as PageTreeRoot,
} from "fumadocs-core/page-tree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
      "block rounded-lg px-3 py-1.5 text-sm",
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
      <div className="mb-4">
        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
          {node.name}
        </p>
        <div className="flex flex-col gap-0.5">
          {node.children.map((child, index) => (
            <SidebarNode
              key={child.$id ?? `${String(child.name)}-${index}`}
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
    <nav className="flex flex-col gap-0.5">
      {tree.children.map((node, index) => (
        <SidebarNode
          key={node.$id ?? `${String(node.name)}-${index}`}
          node={node}
          pathname={pathname}
        />
      ))}
    </nav>
  );
};
