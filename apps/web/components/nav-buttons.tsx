import Link from "next/link";

import { cn } from "@/lib/utils";

export const ChangelogButton = () => (
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
);

export const DocsButton = () => (
  <Link
    aria-label="Docs"
    className={cn(
      "before:absolute before:-inset-y-1 before:inset-x-0",
      "relative flex items-center justify-center px-3 h-8 rounded-full text-sm",
      "font-medium text-white bg-linear-to-b from-blue-400 to-blue-500 shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]",
      "active:scale-[0.96] will-change-transform transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)]"
    )}
    href="/docs"
  >
    <span className="contents select-none">Docs</span>
  </Link>
);
