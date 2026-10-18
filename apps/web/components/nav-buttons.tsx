import Link from "next/link";

import { cn } from "@/lib/utils";

// The outlined buttons. Docs, the filled one, has its own classes below.
const OutlinedNavButton = ({
  destination,
  href,
  label,
}: {
  readonly destination: string;
  readonly href: string;
  readonly label: string;
}) => (
  <Link
    aria-label={label}
    className={cn(
      "shadow-custom bg-background hover:bg-card/30 relative flex h-8 items-center justify-center rounded-full px-2.5 text-sm font-medium sm:px-3",
      "before:absolute before:inset-x-0 before:-inset-y-1",
      "transition-[scale,color,background-color,box-shadow] duration-200 ease-[var(--ease-out)] active:scale-[0.96]"
    )}
    data-destination={destination}
    data-track="nav_clicked"
    href={href}
  >
    <span className="contents select-none">{label}</span>
  </Link>
);

export const ChangelogButton = () => (
  <OutlinedNavButton
    destination="changelog"
    href="/changelog"
    label="Changelog"
  />
);

export const LeaderboardButton = () => (
  <OutlinedNavButton
    destination="leaderboard"
    href="/leaderboard"
    label="Leaderboard"
  />
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
