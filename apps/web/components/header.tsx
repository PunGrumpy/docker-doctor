import Link from "next/link";

import { Logo } from "@/components/logo";
import { ChangelogButton, DocsButton } from "@/components/nav-buttons";

export const Header = () => (
  <header className="absolute right-0 left-0 z-10 mx-auto flex w-full max-w-196 items-center justify-center bg-transparent px-4 lg:px-24">
    <nav className="flex h-16 w-full items-center justify-between">
      <Link aria-label="Home" href="/" className="flex items-center gap-1">
        <Logo className="size-4" />
        Docker Doctor
      </Link>

      <div className="flex gap-2">
        <ChangelogButton />
        <DocsButton />
      </div>
    </nav>
  </header>
);
