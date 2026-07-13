import Link from "next/link";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const Header = () => (
  <header className="absolute left-0 right-0 z-10 mx-auto flex w-full max-w-196 items-center justify-center bg-transparent px-4 lg:px-24">
    <nav className="flex h-16 w-full items-center justify-between">
      <Link aria-label="Home" href="/" className="flex items-center gap-1">
        <Logo className="size-4" />
        Docker Doctor
      </Link>

      <div className="flex gap-2">
        <Link
          aria-label="Changelog"
          className={cn(
            "relative flex items-center justify-center px-3 h-8 rounded-full text-sm font-medium shadow-custom bg-background hover:bg-card/30",
            "before:absolute before:-inset-y-1 before:inset-x-0",
            "active:scale-[0.96] will-change-transform transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)]"
          )}
          href="/changelog"
        >
          <span className="contents select-none">Changelog</span>
        </Link>
        <a
          href="https://github.com/PunGrumpy/docker-doctor"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "before:absolute before:-inset-y-1 before:inset-x-0",
            "relative flex items-center justify-center px-3 h-8 rounded-full text-sm",
            "font-medium text-white bg-linear-to-b from-blue-400 to-blue-500 shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]",
            "active:scale-[0.96] will-change-transform transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)]"
          )}
          aria-label="View on GitHub"
        >
          <span className="contents select-none">GitHub</span>
        </a>
      </div>
    </nav>
  </header>
);
