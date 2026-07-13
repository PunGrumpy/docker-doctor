import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/header";
import { DesignSystemProvider } from "@/components/providers/client";
import { Footer } from "@/components/sections/footer";
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
      <DesignSystemProvider>
        <Header />
        <main className="flex justify-center min-h-screen">
          <div className="relative flex w-full flex-col bg-background overflow-x-clip">
            <div
              className="absolute left-0 top-64 w-full border-t-[0.5px] border-dashed pointer-events-none hidden lg:block"
              aria-hidden="true"
            />
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-196 h-full border-[0.5px] border-dashed pointer-events-none hidden lg:block"
              aria-hidden="true"
            />
            <div className="relative flex flex-col w-full px-4 lg:px-24 max-w-196 mx-auto">
              {children}
              <Footer />
            </div>
          </div>
        </main>
      </DesignSystemProvider>
    </body>
  </html>
);

export default RootLayout;
