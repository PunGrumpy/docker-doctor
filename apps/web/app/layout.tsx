import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DesignSystemProvider } from "@/components/providers/client";
import { fonts } from "@/lib/fonts";
import { url } from "@/lib/url";

const title = "Docker Doctor";
const description =
  "Let coding agents diagnose and fix issues with your Docker containers and infrastructure.";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description,
  metadataBase: new URL(url),
  openGraph: {
    description,
    locale: "en_US",
    siteName: title,
    title,
    type: "website",
    url: new URL("/opengraph-image.png", url).toString(),
  },
  title: {
    default: `${title} › Infrastructure Diagnostics`,
    template: `%s › ${title}`,
  },
  twitter: {
    card: "summary_large_image",
    description,
    title,
  },
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <body className={fonts}>
      <DesignSystemProvider>{children}</DesignSystemProvider>
    </body>
  </html>
);

export default RootLayout;
