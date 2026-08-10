import type { ReactNode } from "react";

import { Header } from "@/components/header";
import { Footer } from "@/components/sections/footer";

interface MarketingLayoutProps {
  readonly children: ReactNode;
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => (
  <>
    <Header />
    <main className="flex min-h-screen justify-center">
      <div className="bg-background relative flex w-full flex-col overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-64 left-0 hidden w-full border-t-[0.5px] border-dashed lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 hidden h-full w-196 -translate-x-1/2 border-x-[0.5px] border-dashed lg:block"
        />
        <div className="relative mx-auto flex w-full max-w-196 flex-col px-4 lg:px-24">
          {children}
          <Footer />
        </div>
      </div>
    </main>
  </>
);

export default MarketingLayout;
