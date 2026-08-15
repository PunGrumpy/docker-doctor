import { Section } from "@/components/section";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import { getScoreData } from "@/lib/score";
import { cn } from "@/lib/utils";

const formatFiles = (entry: LeaderboardEntry): string => {
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

interface RowProps {
  readonly entry: LeaderboardEntry;
  readonly rank: number;
}

const Row = ({ entry, rank }: RowProps) => {
  const scoreData = getScoreData(entry.score);

  return (
    <li className="flex items-center gap-4 py-3">
      <span
        aria-hidden="true"
        className="text-muted-foreground/50 w-6 shrink-0 text-right font-mono text-sm tabular-nums select-none"
      >
        {rank}
      </span>

      <div className="min-w-0 flex-1">
        <a
          href={`${entry.githubUrl}/tree/${entry.commitSha}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-foreground/85 hover:text-foreground block truncate text-sm font-medium",
            "transition-colors duration-200 ease-[var(--ease-out)]",
            "py-1"
          )}
        >
          {entry.name}
        </a>
        <span className="text-muted-foreground/60 block truncate text-xs">
          {formatFiles(entry)}
        </span>
      </div>

      <div
        aria-hidden="true"
        className="bg-muted hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full sm:block lg:w-48"
      >
        <div
          className="h-full rounded-full"
          style={{
            backgroundColor: scoreData.color,
            width: `${entry.score}%`,
          }}
        />
      </div>

      <span className="w-10 shrink-0 text-right font-mono text-sm tabular-nums">
        {entry.score}
        <span className="text-muted-foreground/50">
          <span className="sr-only"> out of </span>
          <span aria-hidden="true">/</span>100
        </span>
      </span>
    </li>
  );
};

interface LeaderboardProps {
  readonly entries: LeaderboardEntry[];
}

export const Leaderboard = ({ entries }: LeaderboardProps) => (
  <Section className="pt-8 pb-16">
    <div className="w-full max-w-2xl">
      <div className="bg-card/20 shadow-custom rounded-2xl p-1">
        <div className="preview-card relative overflow-hidden rounded-xl px-4 py-2">
          <ol className="divide-border/50 divide-y divide-dashed">
            {entries.map((entry, index) => (
              <Row entry={entry} key={entry.slug} rank={index + 1} />
            ))}
          </ol>
        </div>
      </div>

      <p className="text-muted-foreground/70 mt-6 text-center text-xs leading-relaxed">
        Scores are static-analysis lint findings, not a vulnerability audit —
        every Dockerfile and compose file in the repo counts, including dev and
        test setups. Run it on your codebase:{" "}
        <code className="text-muted-foreground font-mono">
          bunx @docker-doctor/cli
        </code>
      </p>
    </div>
  </Section>
);
