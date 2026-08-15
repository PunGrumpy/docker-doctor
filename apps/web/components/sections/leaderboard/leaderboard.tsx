import Image from "next/image";

import { CopyButton } from "@/components/copy-button";
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
  readonly rank: number;
  readonly tied: boolean;
}

const Row = ({ entry, index, rank, tied }: RowProps) => {
  const scoreData = getScoreData(entry.score);

  return (
    <li>
      <a
        className={cn(
          ROW_GRID,
          "-mx-4 gap-y-2 px-4 py-2.5 sm:gap-y-0",
          "hover:bg-muted/40 transition-colors duration-200 ease-[var(--ease-out)]"
        )}
        href={`${entry.githubUrl}/tree/${entry.commitSha}`}
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

const Axis = () => (
  <div aria-hidden="true" className={cn(ROW_GRID, "w-full pt-1")}>
    <span className="hidden sm:block" />
    <div className="text-muted-foreground relative col-span-2 col-start-1 h-5 font-mono text-xs tabular-nums select-none sm:col-span-1 sm:col-start-2">
      <span className="absolute left-0">0</span>
      <span className="absolute left-1/2 -translate-x-1/2">50</span>
      <span className="absolute right-0">100</span>
    </div>
    <span className="hidden sm:block" />
  </div>
);

interface LeaderboardProps {
  readonly entries: LeaderboardEntry[];
}

export const Leaderboard = ({ entries }: LeaderboardProps) => (
  <Section className="pt-8 pb-16">
    <div className="w-full max-w-2xl">
      <div className="bg-card/20 shadow-custom rounded-2xl p-1">
        <div className="preview-card relative overflow-hidden rounded-xl px-4 py-2">
          <ol className="divide-border/50 w-full list-none gap-0 divide-y divide-dashed pl-0">
            {entries.map((entry, index) => (
              <Row
                entry={entry}
                index={index}
                key={entry.slug}
                // Competition ranking: tied scores share the first index.
                rank={entries.findIndex((e) => e.score === entry.score) + 1}
                tied={entries.filter((e) => e.score === entry.score).length > 1}
              />
            ))}
          </ol>
          <Axis />
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-4">
        <p className="text-muted-foreground max-w-md text-center text-xs leading-relaxed">
          Scores are static-analysis lint findings, not a vulnerability audit —
          every Dockerfile and compose file in the repo counts, including dev
          and test setups. Run it on your codebase:
        </p>
        <div className="bg-background shadow-border flex items-center gap-3 rounded-xl py-1.5 pr-1.5 pl-4">
          <span
            aria-hidden="true"
            className="text-muted-foreground/60 font-mono text-sm select-none"
          >
            $
          </span>
          <code className="text-muted-foreground shimmer font-mono text-sm">
            bunx @docker-doctor/cli
          </code>
          <CopyButton
            aria-label="Copy scan command"
            data-track="leaderboard_command_copied"
            value="bunx @docker-doctor/cli"
          />
        </div>
      </div>
    </div>
  </Section>
);
