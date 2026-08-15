"use client";

import Image from "next/image";
import { useState } from "react";

import { Section } from "@/components/section";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import { getScoreData } from "@/lib/score";
import { cn } from "@/lib/utils";

const BAR_STAGGER_MS = 40;

// Shared by rows and the axis footer so the bars sit on one aligned
// 0-100 track. Below sm the bar drops to a full-width second row.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_2.5rem]";

const formatFiles = (entry: LeaderboardEntry): string => {
  const total = entry.dockerfileCount + entry.composeFileCount;
  return `${total} Docker file${total === 1 ? "" : "s"}`;
};

const formatFilesDetail = (entry: LeaderboardEntry): string => {
  const parts: string[] = [];
  if (entry.dockerfileCount > 0) {
    parts.push(
      `${entry.dockerfileCount} Dockerfile${entry.dockerfileCount === 1 ? "" : "s"}`
    );
  }
  if (entry.composeFileCount > 0) {
    parts.push(
      `${entry.composeFileCount} compose file${entry.composeFileCount === 1 ? "" : "s"}`
    );
  }
  return parts.join(" · ");
};

const ownerOf = (entry: LeaderboardEntry): string =>
  new URL(entry.githubUrl).pathname.split("/")[1] ?? entry.slug;

interface RowProps {
  readonly entry: LeaderboardEntry;
  readonly index: number;
  readonly onActivate: (entry: LeaderboardEntry) => void;
  readonly onDeactivate: () => void;
  readonly rank: number;
  readonly tied: boolean;
}

const Row = ({
  entry,
  index,
  onActivate,
  onDeactivate,
  rank,
  tied,
}: RowProps) => {
  const scoreData = getScoreData(entry.score);

  return (
    <li>
      <a
        className={cn(
          ROW_GRID,
          "-mx-3 gap-y-2 border-b border-dashed px-3 py-2.5 sm:gap-y-0",
          "border-border/50 hover:bg-muted/40 transition-colors duration-200 ease-[var(--ease-out)]"
        )}
        href={`${entry.githubUrl}/tree/${entry.commitSha}`}
        onBlur={onDeactivate}
        onFocus={() => onActivate(entry)}
        onMouseEnter={() => onActivate(entry)}
        onMouseLeave={onDeactivate}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 sm:col-auto sm:row-auto">
          <span
            aria-label={tied ? `Rank ${rank}, tied` : `Rank ${rank}`}
            className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums"
          >
            <span className="inline-block w-4 text-right">{rank}</span>
            <span aria-hidden="true" className="inline-block w-2 text-left">
              {tied ? "=" : ""}
            </span>
          </span>
          <Image
            alt=""
            className="shrink-0 rounded-[4px]"
            height={20}
            src={`https://github.com/${ownerOf(entry)}.png`}
            width={20}
          />
          <span className="min-w-0">
            <span className="text-foreground/85 block truncate text-sm font-medium">
              {entry.name}
            </span>
            <span
              className="text-muted-foreground block truncate text-xs"
              title={formatFilesDetail(entry)}
            >
              {formatFiles(entry)}
            </span>
          </span>
        </div>

        <div
          aria-hidden="true"
          className="bg-muted col-span-2 col-start-1 row-start-2 h-2 w-full overflow-hidden rounded-full sm:col-span-1 sm:col-start-2 sm:row-start-1"
        >
          <div
            className="bar-grow h-full rounded-full"
            style={{
              animationDelay: `${index * BAR_STAGGER_MS}ms`,
              backgroundColor: scoreData.color,
              width: `${entry.score}%`,
            }}
          />
        </div>

        <span className="col-start-2 row-start-1 text-right font-mono text-sm tabular-nums sm:col-start-3">
          {entry.score}
          <span className="sr-only"> out of 100</span>
        </span>
      </a>
    </li>
  );
};

interface AxisProps {
  readonly active: LeaderboardEntry | null;
  readonly visible: boolean;
}

const Axis = ({ active, visible }: AxisProps) => (
  <div aria-hidden="true" className={cn(ROW_GRID, "w-full pt-1")}>
    <span className="hidden sm:block" />
    <div className="text-muted-foreground relative col-span-2 col-start-1 h-5 font-mono text-xs tabular-nums select-none sm:col-span-1 sm:col-start-2">
      <span className="absolute left-0">0</span>
      <span className="absolute left-1/2 -translate-x-1/2">50</span>
      <span className="absolute right-0">100</span>
      {/* floating value that tracks the hovered/focused row's bar */}
      <span
        className="bg-background absolute -translate-x-1/2 px-1 font-medium whitespace-nowrap transition-[left,opacity,color] duration-150 ease-[var(--ease-out)]"
        style={{
          color: active ? getScoreData(active.score).color : undefined,
          left: `${active?.score ?? 0}%`,
          opacity: visible ? 1 : 0,
        }}
      >
        {active?.score}
      </span>
    </div>
    <span className="hidden sm:block" />
  </div>
);

interface LeaderboardProps {
  readonly doctorVersion: string;
  readonly entries: LeaderboardEntry[];
  readonly generatedAt: string;
}

export const Leaderboard = ({
  doctorVersion,
  entries,
  generatedAt,
}: LeaderboardProps) => {
  const [active, setActive] = useState<LeaderboardEntry | null>(null);
  const [visible, setVisible] = useState(false);

  const activate = (entry: LeaderboardEntry) => {
    setActive(entry);
    setVisible(true);
  };
  // Keep the last entry so the label fades out in place instead of
  // snapping to 0 while it disappears.
  const deactivate = () => setVisible(false);

  return (
    <Section className="pt-8 pb-16">
      <div className="w-full max-w-2xl">
        {/* w-full + list resets: globals.css styles every ul/ol for
            prose content (flex, gap, pl-5, markers) */}
        <ol className="w-full list-none gap-0 pl-0">
          {entries.map((entry, index) => (
            <Row
              entry={entry}
              index={index}
              key={entry.slug}
              onActivate={activate}
              onDeactivate={deactivate}
              // Competition ranking: tied scores share the first index.
              rank={entries.findIndex((e) => e.score === entry.score) + 1}
              tied={entries.filter((e) => e.score === entry.score).length > 1}
            />
          ))}
        </ol>
        <Axis active={active} visible={visible} />

        <p className="text-muted-foreground mx-auto mt-8 max-w-md text-center text-xs leading-relaxed">
          Lint scores from the Docker Doctor CLI v{doctorVersion} on{" "}
          {generatedAt.slice(0, 10)} — not a vulnerability audit; every
          Dockerfile and Compose file in the repo counts.
        </p>
      </div>
    </Section>
  );
};
