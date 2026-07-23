import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

interface DocsRootLayoutProps {
  readonly children: ReactNode;
}

// `theme: { enabled: false }` defers all theming to the site-wide
// `next-themes` provider already mounted in the root layout — Fumadocs
// must not mount a second competing theme provider here.
const DocsRootLayout = ({ children }: DocsRootLayoutProps) => (
  <RootProvider theme={{ enabled: false }}>
    <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  </RootProvider>
);

export default DocsRootLayout;
