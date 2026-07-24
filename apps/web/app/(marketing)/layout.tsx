import type { ReactNode } from "react";

import { Header } from "@/components/header";
import { Footer } from "@/components/sections/footer";

interface MarketingLayoutProps {
  readonly children: ReactNode;
}

const MarketingLayout = ({ children }: MarketingLayoutProps) => (
  <>
    <Header />
    <main className="flex justify-center min-h-screen">
      <div className="relative flex w-full flex-col bg-background overflow-x-clip">
        <div
          aria-hidden="true"
          className="absolute left-0 top-64 w-full border-t-[0.5px] border-dashed pointer-events-none hidden lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-196 h-full border-x-[0.5px] border-dashed pointer-events-none hidden lg:block"
        />
        <div className="relative flex flex-col w-full px-4 lg:px-24 max-w-196 mx-auto">
          {children}
          <Footer />
        </div>
      </div>
    </main>
  </>
);

export default MarketingLayout;
