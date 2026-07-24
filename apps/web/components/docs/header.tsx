import Link from "next/link";

import { DocsMobileNav } from "@/components/docs/mobile-nav";
import { Logo } from "@/components/logo";
import { ChangelogButton, DocsButton } from "@/components/nav-buttons";
import { source } from "@/lib/source";

export const Header = () => (
  <header className="sticky top-0 z-20 border-b border-dashed bg-background">
    <nav
      aria-label="Primary"
      className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-4 lg:px-14"
    >
      <div className="flex items-center gap-2">
        <DocsMobileNav tree={source.getPageTree()} />
        <Link className="flex items-center gap-1.5 font-medium" href="/">
          <Logo aria-hidden="true" className="size-4" />
          Docker Doctor
        </Link>
      </div>

      <div className="hidden gap-2 lg:flex">
        <ChangelogButton />
        <DocsButton />
      </div>
    </nav>
  </header>
);
