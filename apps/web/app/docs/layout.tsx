import Link from "next/link";
import type { ReactNode } from "react";

import { DocsSidebar } from "@/components/docs/sidebar";
import { Logo } from "@/components/logo";
import { ChangelogButton, GitHubButton } from "@/components/nav-buttons";
import { source } from "@/lib/source";

interface DocsRootLayoutProps {
  readonly children: ReactNode;
}

const DocsRootLayout = ({ children }: DocsRootLayoutProps) => (
  <div className="flex min-h-dvh flex-col">
    <header className="sticky top-0 z-20 border-b border-dashed bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-4 lg:px-8">
        <Link
          aria-label="Home"
          className="flex items-center gap-1.5 font-medium"
          href="/"
        >
          <Logo className="size-4" />
          Docker Doctor
        </Link>

        <div className="flex gap-2">
          <ChangelogButton />
          <GitHubButton />
        </div>
      </nav>
    </header>

    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 px-4 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-4 hidden border-l border-dashed lg:left-8 lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-4 hidden border-r border-dashed lg:right-8 lg:block"
      />

      <div className="grid w-full grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto border-e border-dashed py-8 pe-4">
            <DocsSidebar tree={source.getPageTree()} />
          </div>
        </aside>

        <main className="min-w-0 py-8 lg:py-12">{children}</main>
      </div>
    </div>
  </div>
);

export default DocsRootLayout;
