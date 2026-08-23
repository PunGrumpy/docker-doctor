import Link from "next/link";

import { cn } from "@/lib/utils";

export const ChangelogButton = () => (
  <Link
    aria-label="Changelog"
    className={cn(
      "shadow-custom bg-background hover:bg-card/30 relative flex h-8 items-center justify-center rounded-full px-2.5 text-sm font-medium sm:px-3",
      "before:absolute before:inset-x-0 before:-inset-y-1",
      "transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
    )}
    data-destination="changelog"
    data-track="nav_clicked"
    href="/changelog"
  >
    <span className="contents select-none">Changelog</span>
  </Link>
);

export const LeaderboardButton = () => (
  <Link
    aria-label="Leaderboard"
    className={cn(
      "shadow-custom bg-background hover:bg-card/30 relative flex h-8 items-center justify-center rounded-full px-2.5 text-sm font-medium sm:px-3",
      "before:absolute before:inset-x-0 before:-inset-y-1",
      "transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
    )}
    data-destination="leaderboard"
    data-track="nav_clicked"
    href="/leaderboard"
  >
    <span className="contents select-none">Leaderboard</span>
  </Link>
);

export const DocsButton = () => (
  <Link
    aria-label="Docs"
    className={cn(
      "before:absolute before:inset-x-0 before:-inset-y-1",
      "relative flex h-8 items-center justify-center rounded-full px-2.5 text-sm sm:px-3",
      "bg-linear-to-b from-blue-400 to-blue-500 font-medium text-white shadow-[0px_0px_1px_1px_rgba(255,255,255,0.06)_inset,0px_1.5px_2px_0px_rgba(0,0,0,0.1),0px_0px_0px_1px_var(--color-blue-500)]",
      "transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
    )}
    data-destination="docs"
    data-track="nav_clicked"
    href="/docs"
  >
    <span className="contents select-none">Docs</span>
  </Link>
);
