import { ArrowUpRight, Stethoscope } from "lucide-react";

import { Badge } from "@/components/badge";
import { GitHub } from "@/components/icons/github";
import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

const LIVE_EXAMPLE_URL = "https://github.com/PunGrumpy/docker-doctor/pull/38";

const DOT_COLORS = {
  clean: "bg-[#44cc11]",
  error: "bg-[#ee0000]",
  good: "bg-[#dfb317]",
} as const;

const Dot = ({ tone }: { readonly tone: keyof typeof DOT_COLORS }) => (
  <span
    aria-hidden="true"
    className={cn("size-2.5 shrink-0 rounded-full", DOT_COLORS[tone])}
  />
);

const FILE_ROWS = [
  {
    file: "Dockerfile",
    issues: "1 error, 2 warnings",
    status: "Error",
    tone: "error",
  },
  {
    file: "compose.yml",
    issues: "—",
    status: "Clean",
    tone: "clean",
  },
] as const;

export const ActionDemo = () => (
  <Section className="pt-8 pb-16 flex flex-col items-center w-full">
    <h1 className="flex flex-col items-center justify-center text-3xl font-normal tracking-tight text-foreground sm:text-5xl">
      <span className="relative top-[-0.08em] ml-1 inline-flex items-center gap-3 rounded-lg bg-muted px-3 py-[0.04em] pr-4 align-baseline font-serif">
        <GitHub aria-hidden="true" className="size-8 text-muted-foreground" />
        every pull request
      </span>
      <Badge
        aria-hidden="true"
        className="-top-7 left-1/4 -translate-x-1/4 mb-7"
      >
        <span className="block px-1.5 py-1 font-mono text-xs select-none whitespace-nowrap rounded-lg bg-card text-muted-foreground tracking-normal shadow-custom">
          the action
        </span>
        <span className="absolute flex items-center top-full left-1/2 -translate-x-1/2 flex-col">
          <span className="border-dashed h-3 border-l" />
          <span className="block shrink-0 rounded-full bg-border p-0.5">
            <span className="block size-[5px] shrink-0 rounded-full bg-background" />
          </span>
        </span>
      </Badge>
    </h1>

    <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-sm text-muted-foreground">
      Add <span className="font-mono">PunGrumpy/docker-doctor@v0</span> to your
      workflow and every pull request gets one sticky summary comment — advisory
      by default, gate when you trust it.
    </p>

    <div className="mt-8 w-full max-w-2xl rounded-3xl bg-card shadow-border overflow-hidden select-none">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-b-[#EBEBEB] dark:border-b-[#1f1f1f]">
        <span className="flex items-center justify-center size-9 shrink-0 rounded-full bg-muted">
          <Stethoscope
            aria-hidden="true"
            className="size-4.5 text-muted-foreground"
          />
        </span>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-foreground">docker-doctor</span>
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            Bot
          </span>
          <span className="text-muted-foreground">commented 2 days ago</span>
        </div>
      </div>

      <div className="p-6 space-y-5 text-sm">
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_7rem_9rem] gap-x-6 text-xs text-muted-foreground border-b pb-2">
            <span>File</span>
            <span>Status</span>
            <span className="hidden sm:block">Issues</span>
          </div>
          {FILE_ROWS.map((row) => (
            <div
              className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_7rem_9rem] gap-x-6 items-center"
              key={row.file}
            >
              <span className="font-mono text-[13px] text-foreground">
                {row.file}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Dot tone={row.tone} />
                {row.status}
              </span>
              <span className="hidden sm:block text-muted-foreground">
                {row.issues}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">Score:</span>
          <span className="font-mono tabular-nums text-foreground">
            84 / 100
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <Dot tone="good" />
          <span className="text-muted-foreground">Good</span>
        </div>

        <div className="rounded-xl border bg-muted/10 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Dot tone="error" />
            <span className="font-mono text-[13px] text-foreground">
              Dockerfile:2
            </span>
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              no-secrets-in-env
            </span>
          </div>
          <p className="text-muted-foreground text-wrap-pretty">
            Potential secret found in ENV: &lsquo;DB_PASSWORD&rsquo;. Use Docker
            Secrets or runtime environment variables instead of baking them into
            the image.
          </p>
        </div>
      </div>

      <a
        className="group flex items-center justify-end gap-1.5 px-6 py-3.5 border-t bg-muted/20 dark:bg-muted/5 text-xs text-muted-foreground transition-opacity hover:opacity-70 select-auto"
        href={LIVE_EXAMPLE_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span>
          View a live example on{" "}
          <span className="font-medium text-foreground">
            PunGrumpy/docker-doctor
          </span>
        </span>
        <ArrowUpRight
          aria-hidden="true"
          className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </a>
    </div>
  </Section>
);
