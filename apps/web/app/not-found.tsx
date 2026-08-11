import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/header";
import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "Page not found",
};

const NotFound = () => (
  <>
    <Header />
    <main className="flex min-h-screen justify-center">
      <div className="bg-background relative flex w-full flex-col overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-1/2 hidden h-full w-196 -translate-x-1/2 border-x-[0.5px] border-dashed lg:block"
        />
        <div className="relative mx-auto flex w-full max-w-196 flex-col px-4 lg:px-24">
          <Section className="gap-4 pt-32 pb-24">
            <span className="text-muted-foreground/60 font-mono text-sm tabular-nums select-none">
              404
            </span>
            <h1 className="text-foreground font-serif text-3xl font-normal tracking-tight sm:text-5xl">
              Page not found
            </h1>
            <p className="text-muted-foreground text-center text-balance">
              This page has no diagnosis — it never existed, or it moved.
            </p>
            <div className="mt-4 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
              <Link
                className={cn(
                  "shadow-custom bg-background hover:bg-card/30 flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm font-medium sm:w-auto",
                  "transition-[scale,background-color] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
                )}
                data-destination="home"
                data-track="not_found_recovery_clicked"
                href="/"
              >
                <span className="contents select-none">Back home</span>
              </Link>
              <Link
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-xl px-4 text-sm sm:w-auto",
                  "bg-linear-to-b from-blue-400 to-blue-500 font-medium text-white shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]",
                  "transition-[scale,background-color] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
                )}
                data-destination="docs"
                data-track="not_found_recovery_clicked"
                href="/docs"
              >
                <span className="contents select-none">Read the docs</span>
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </main>
  </>
);

export default NotFound;
