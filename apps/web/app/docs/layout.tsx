import type { ReactNode } from "react";

import { Header } from "@/components/docs/header";
import { DocsSidebar } from "@/components/docs/sidebar";
import { source } from "@/lib/source";

interface DocsRootLayoutProps {
  readonly children: ReactNode;
}

const DocsRootLayout = ({ children }: DocsRootLayoutProps) => (
  <div className="flex min-h-dvh flex-col">
    <a
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:font-medium focus:text-sm focus:shadow-custom"
      href="#docs-content"
    >
      Skip to content
    </a>
    <Header />

    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 bottom-0 z-30 mx-auto hidden w-full max-w-[1200px] px-4 lg:block lg:px-8"
    >
      <div className="absolute inset-y-0 left-4 border-l border-dashed lg:left-8" />
      <div className="absolute inset-y-0 right-4 border-r border-dashed lg:right-8" />
      {/* Sidebar divider: fixed so its dashes don't shimmer with the sticky
          sidebar. Sits at the 240px column's right edge (lg:px-8 + 240px). */}
      <div className="absolute top-14 bottom-0 left-[calc(2rem+240px)] border-l border-dashed" />
    </div>

    <div className="relative mx-auto flex w-full max-w-[1200px] flex-1 px-4 pt-14 lg:px-8">
      <div className="grid w-full grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <div className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto py-8 pe-4 ps-4">
            <DocsSidebar tree={source.getPageTree()} />
          </div>
        </aside>

        <main
          className="min-w-0 py-8 focus:outline-none lg:py-12"
          id="docs-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  </div>
);

export default DocsRootLayout;
