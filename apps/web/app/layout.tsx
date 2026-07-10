import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DesignSystemProvider } from "@/components/providers/client";
import { fonts } from "@/lib/fonts";

const title = "Docker Doctor";
const description =
  "Let coding agents diagnose and fix issues with your Docker containers and infrastructure.";

export const metadata: Metadata = {
  description,
  title,
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <body className={fonts}>
      <DesignSystemProvider>
        <main className="mx-auto max-w-180 px-5 py-12 leading-relaxed sm:py-20">
          {children}
        </main>
      </DesignSystemProvider>
    </body>
  </html>
);

export default RootLayout;
