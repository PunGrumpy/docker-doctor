"use client";

import { Play, Pause, RotateCcw, Check, AlertTriangle } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { ClaudeDiff } from "@/components/claude/claude-diff";
import { ClaudeHeader } from "@/components/claude/claude-header";
import { ClaudeThinking } from "@/components/claude/claude-thinking";
import { ClaudeTodoList } from "@/components/claude/claude-todo-list";
import { Plus } from "@/components/icons/plus";
import { Section } from "@/components/section";
import { cn } from "@/lib/utils";

const COMMAND = "docker-doctor .";
const TOTAL_TICKS = 210;
const TICK_MS = 100;
const SPINNERFRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const Cursor = ({ visible }: { readonly visible: boolean }) => {
  if (!visible) {
    return null;
  }
  return (
    <span className="bg-foreground inline-block h-4 w-2 shrink-0 animate-pulse" />
  );
};

interface PromptLineProps {
  readonly visible: boolean;
  readonly cursorVisible: boolean;
  readonly commandText: string;
}

const PromptLine = ({
  visible,
  cursorVisible,
  commandText,
}: PromptLineProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        animation: "fadeInUp 300ms var(--ease-out) forwards",
      }}
    >
      <div className="text-foreground flex items-center gap-2">
        <span className="font-bold text-emerald-500 select-none">$</span>
        <span>{commandText}</span>
        <Cursor visible={cursorVisible} />
      </div>
    </div>
  );
};

interface CommandOutputsProps {
  readonly ticks: number;
  readonly currentSpinner: string;
}

const getCommandSlice = (
  ticks: number,
  start: number,
  duration: number,
  command: string
): string => {
  if (ticks < start) {
    return "";
  }
  if (ticks >= start + duration) {
    return command;
  }
  const factor = (ticks - start) / duration;
  return command.slice(0, Math.floor(factor * command.length));
};

const getProgressBar = (score: number): React.ReactNode => {
  const filledBlocks = Math.round(score / 2);
  const emptyBlocks = 50 - filledBlocks;
  const filledColor =
    score === 100
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-amber-500 dark:text-amber-400";
  const emptyColor = "text-muted-foreground/20 dark:text-muted-foreground/10";

  return (
    <span className="font-mono tracking-tighter select-none">
      <span className={cn(filledColor, "font-bold")}>
        {"█".repeat(filledBlocks)}
      </span>
      <span className={emptyColor}>{"░".repeat(emptyBlocks)}</span>
    </span>
  );
};

const Command1Outputs = ({ ticks, currentSpinner }: CommandOutputsProps) => {
  if (ticks < 16) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground transition-opacity duration-200">
        {ticks < 36 ? (
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-500">{currentSpinner}</span>
            <span>
              {ticks < 23 && "Discovering workspace..."}
              {ticks >= 23 && ticks < 29 && "Analyzing 1 Dockerfile(s)..."}
              {ticks >= 29 && "Analyzing 1 Compose file(s)..."}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-500">
            <Check className="size-3.5 text-emerald-500" />
            <span>Scanning files completed!</span>
          </div>
        )}
      </div>

      {ticks >= 36 && (
        <div className="stagger-enter flex flex-col gap-1 transition-opacity duration-200">
          <div className="text-foreground font-semibold">Found 3 issue(s):</div>
          <div className="flex items-center gap-2 pl-4 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="size-3.5" />
            <span>Security › 1 warning</span>
          </div>
          <div className="flex items-center gap-2 pl-4 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="size-3.5" />
            <span>Best Practices › 1 warning</span>
          </div>
        </div>
      )}

      {ticks >= 56 && (
        <div className="space-y-4">
          <div
            className="text-foreground stagger-enter font-bold underline"
            style={{ animationDelay: "0ms" }}
          >
            Dockerfile
          </div>

          <div
            className="stagger-enter space-y-2 rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4"
            style={{ animationDelay: "50ms" }}
          >
            <div className="flex items-center justify-between font-bold text-yellow-600 dark:text-yellow-400">
              <span>⚠ WARN [docker-doctor/pin-image-version]:1</span>
            </div>
            <div className="text-muted-foreground space-y-1 border-l-2 border-yellow-500/40 pl-4 text-xs leading-relaxed">
              <div className="flex font-mono">
                <span className="text-muted-foreground/45 w-10 select-none">
                  {" "}
                  1 │{" "}
                </span>
                <span className="text-foreground">FROM node:latest</span>
              </div>
              <div className="flex font-mono opacity-50">
                <span className="text-muted-foreground/45 w-10 select-none">
                  {" "}
                  2 │{" "}
                </span>
                <span>COPY . .</span>
              </div>
            </div>
            <div className="text-foreground pl-4 text-xs font-medium">
              Base image &apos;node&apos; uses the mutable &apos;latest&apos;
              tag. This makes builds non-deterministic.
            </div>
            <div className="text-muted-foreground pl-4 text-xs">
              <span className="text-foreground font-semibold">Help:</span>{" "}
              Specify a concrete tag instead of &apos;latest&apos; or no tag
              (e.g., &apos;node:22.2.0-alpine&apos;).
            </div>
          </div>

          <div
            className="bg-muted/10 stagger-enter flex flex-col items-center gap-4 rounded-xl border p-4 sm:flex-row"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex shrink-0 flex-col text-center font-mono leading-none font-bold text-red-500/80 sm:text-left dark:text-red-500/60">
              <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span>&nbsp;.---.&nbsp;&nbsp;</span>
              <span>(&nbsp;x&nbsp;x&nbsp;)&gt;</span>
              <span>&nbsp;\___/&nbsp;&nbsp;</span>
            </div>
            <div className="w-full flex-1 space-y-1 text-center sm:text-left">
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <span className="font-mono font-bold text-red-500 tabular-nums dark:text-red-400">
                  45 / 100
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  Needs work
                </span>
              </div>
              <div className="w-full overflow-hidden text-left text-[11px] select-none">
                {getProgressBar(45)}
              </div>
              <div className="text-muted-foreground font-mono text-[10px]">
                Docker Doctor (https://docker-doctor.vercel.app)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Command2Outputs = ({ ticks }: { readonly ticks: number }) => {
  if (ticks < 106) {
    return null;
  }

  return (
    <div
      className="stagger-enter flex w-full flex-col space-y-4"
      style={{ animationDelay: "0ms" }}
    >
      <ClaudeHeader
        version="v2.1"
        user="PunGrumpy"
        model="Fable 5 with max effort"
        org="docker-doctor Organization"
        cwd="~/Developments/docker-doctor"
        tips={[
          "Ask Claude to fix configuration issues",
          "Run /doctor to analyze performance",
        ]}
        whatsNew={[
          "Interactive radiogroups for permission prompts",
          "Accessible, keyboard-operable details blocks",
        ]}
        className="bg-card text-foreground dark:text-[#c0caf5]"
      />

      {ticks >= 112 && (
        <ClaudeTodoList
          todos={[
            {
              label: "Analyze Dockerfile layout",
              status: "done",
            },
            {
              label: "Pin Node.js base image version and add non-root user",
              status: ticks >= 118 ? "done" : "active",
            },
          ]}
        />
      )}

      {ticks < 118 && (
        <ClaudeThinking
          running
          verbs={["Levitating", "Herding", "Percolating", "Conjuring"]}
          showTokens
          className="text-foreground dark:text-[#c0caf5]"
        />
      )}

      {ticks >= 118 && (
        <div
          className="stagger-enter w-full space-y-4"
          style={{ animationDelay: "50ms" }}
        >
          <ClaudeDiff
            file="Dockerfile"
            summary="Updated Dockerfile: pinned base image version, added non-root USER instruction"
            lines={[
              { n: 1, text: "FROM node:latest", type: "del" },
              { n: 1, text: "FROM node:22.2.0-alpine", type: "add" },
              { n: 2, text: "COPY . .", type: "ctx" },
              { n: 3, text: "RUN npm install", type: "ctx" },
              { n: 4, text: "USER node", type: "add" },
              { n: 5, text: 'CMD ["npm", "start"]', type: "ctx" },
            ]}
            className="text-foreground w-full dark:text-[#c0caf5]"
          />

          <div
            className="stagger-enter flex items-center gap-1.5 text-xs whitespace-nowrap text-[#424242] dark:text-[#C6C6C6]"
            style={{ animationDelay: "100ms" }}
          >
            <span className="inline-block w-[1ch] text-center font-bold text-[#cd694a]">
              ✻
            </span>
            <span className="font-mono text-[13px]">Done in 1.4s</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Command3Outputs = ({ ticks, currentSpinner }: CommandOutputsProps) => {
  if (ticks < 151) {
    return null;
  }

  return (
    <div className="space-y-4">
      {ticks < 166 ? (
        <div className="text-muted-foreground flex items-center gap-2">
          <span className="font-bold text-cyan-500">{currentSpinner}</span>
          <span>Analyzing workspace...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="stagger-enter flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"
            style={{ animationDelay: "0ms" }}
          >
            <Check className="mt-0.5 size-5 shrink-0 text-emerald-500" />
            <div className="space-y-1">
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                ✔ No issues found! Your Docker setup looks healthy.
              </div>
              <div className="text-muted-foreground text-wrap-pretty text-xs">
                Verified building with Docker engine. All safety, performance,
                and best practices rules passed successfully.
              </div>
            </div>
          </div>

          <div
            className="text-muted-foreground stagger-enter flex flex-col items-start gap-1 font-mono text-sm leading-relaxed"
            style={{ animationDelay: "50ms" }}
          >
            <div className="text-foreground font-semibold">
              ✅ All issues fixed
            </div>
            <div className="flex items-center gap-1.5">
              <span>Docker Doctor score:</span>
              <span className="relative inline-block font-bold whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="bg-muted/40 dark:bg-muted/30 absolute -inset-x-[3px] inset-y-0 origin-left"
                />
                <span className="text-foreground dark:text-foreground relative">
                  100/100
                </span>
              </span>
            </div>
          </div>

          <div
            className="bg-muted/10 stagger-enter flex flex-col items-center gap-4 rounded-xl border p-4 sm:flex-row"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex shrink-0 flex-col text-center font-mono leading-none font-bold text-emerald-500/80 sm:text-left dark:text-emerald-500/60">
              <span className="text-cyan-500/80">
                &nbsp;&nbsp;&quot;:&quot;&nbsp;&nbsp;&nbsp;
              </span>
              <span>&nbsp;.---.&nbsp;&nbsp;</span>
              <span>(&nbsp;◠&nbsp;◠&nbsp;)&gt;</span>
              <span>&nbsp;\___/&nbsp;&nbsp;</span>
            </div>
            <div className="w-full flex-1 space-y-1 text-center sm:text-left">
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <span className="font-mono font-bold text-emerald-500 tabular-nums dark:text-emerald-400">
                  100 / 100
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  Healthy
                </span>
              </div>
              <div className="w-full overflow-hidden text-left text-[11px] select-none">
                {getProgressBar(100)}
              </div>
              <div className="text-muted-foreground font-mono text-[10px]">
                Docker Doctor (https://docker-doctor.vercel.app)
              </div>
            </div>
          </div>

          <div
            className="text-muted-foreground/60 stagger-enter flex items-center justify-center gap-1.5 pt-2 text-center text-xs italic select-none"
            style={{ animationDelay: "150ms" }}
          >
            <span>Completed loop. Restarting in a few seconds...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const TerminalDemo = () => {
  const [ticks, setTicks] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const terminalBodyRef = useRef<HTMLDivElement>(null);
  const lastScrollHeightRef = useRef(0);

  useEffect(() => {
    const el = terminalBodyRef.current;
    if (!el) {
      return;
    }
    if (el.scrollHeight <= lastScrollHeightRef.current) {
      lastScrollHeightRef.current = el.scrollHeight;
      return;
    }
    lastScrollHeightRef.current = el.scrollHeight;
    el.scrollTo({ top: el.scrollHeight });
  }, [ticks]);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setTicks((prev) => {
        if (prev >= TOTAL_TICKS) {
          return 0;
        }
        return prev + 1;
      });
    }, TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [isPaused]);

  const commandText1 = getCommandSlice(ticks, 1, 14, COMMAND);
  const commandText2 = getCommandSlice(ticks, 86, 19, "claude");
  const commandText3 = getCommandSlice(ticks, 136, 14, COMMAND);

  const currentSpinner = SPINNERFRAMES[ticks % SPINNERFRAMES.length];

  return (
    <Section className="flex w-full flex-col items-center pt-8 pb-16 lg:pb-32">
      <div className="bg-card shadow-border relative w-full max-w-2xl overflow-hidden rounded-3xl">
        <div className="relative flex h-[45px] w-full shrink-0 items-center justify-center border-b border-b-[#EBEBEB] select-none dark:border-b-[#1f1f1f]">
          <div className="w-max text-center text-[17px] leading-[145%] font-medium text-[#6E6E6E] dark:text-[#7A7A7A]">
            Terminal - 592x648
          </div>
          <div className="absolute top-[15px] left-[18px] flex w-fit items-start gap-2">
            <div className="size-[17px] shrink-0 rounded-full bg-[oklch(71.3%_0.171_26)] dark:bg-[#323232]" />
            <div className="size-[17px] shrink-0 rounded-full bg-[oklch(82.5%_0.159_80.9)] dark:bg-[#323232]" />
            <div className="size-[17px] shrink-0 rounded-full bg-[oklch(88.4%_0_0)] dark:bg-[#323232]" />
          </div>
        </div>

        <div className="flex h-[38px] w-full shrink-0 select-none">
          <div className="flex h-[38px] flex-1 items-center justify-center border-b border-b-[#EBEBEB] dark:border-b-[#1f1f1f]">
            <span className="shrink-0 text-center text-[16px] leading-[145%] font-medium text-[#464646] dark:text-[#F1F1F1]">
              docker-doctor
            </span>
          </div>
          <div className="flex h-[38px] w-10 shrink-0 items-center justify-center border-b border-l border-b-[#EBEBEB] border-l-[#EBEBEB] bg-[#F9F9F9] dark:border-b-[#1f1f1f] dark:border-l-[#1f1f1f] dark:bg-[#08090a]">
            <Plus
              className="size-5 shrink-0 text-[#AFAFAF]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          ref={terminalBodyRef}
          className="bg-card h-[500px] space-y-4 overflow-hidden p-6 font-mono text-sm leading-relaxed antialiased select-text sm:text-[13px]"
        >
          <div className="text-foreground flex items-center gap-2">
            <span className="font-bold text-emerald-500 select-none">$</span>
            <span>{commandText1}</span>
            <Cursor visible={ticks < 16} />
          </div>

          <Command1Outputs ticks={ticks} currentSpinner={currentSpinner} />

          <PromptLine
            visible={ticks >= 76}
            cursorVisible={ticks < 106}
            commandText={commandText2}
          />

          <Command2Outputs ticks={ticks} />

          <PromptLine
            visible={ticks >= 126}
            cursorVisible={ticks < 151}
            commandText={commandText3}
          />

          <Command3Outputs ticks={ticks} currentSpinner={currentSpinner} />
        </div>

        <div className="bg-muted/20 dark:bg-muted/5 flex items-center justify-between border-t px-5 py-3.5 text-xs select-none">
          <div className="text-muted-foreground/60 flex items-center gap-2 font-mono">
            <span>Tick:</span>
            <span className="text-foreground w-8 font-semibold tabular-nums">
              {ticks}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 font-medium",
                "bg-card hover:bg-muted/40",
                "transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.96]"
              )}
              aria-label={isPaused ? "Play simulation" : "Pause simulation"}
            >
              {isPaused ? (
                <>
                  <Play className="fill-foreground size-3.5" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="fill-foreground size-3.5" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setTicks(0);
                setIsPaused(false);
              }}
              className={cn(
                "bg-card hover:bg-muted/40 flex size-9 items-center justify-center rounded-lg border",
                "transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.96]"
              )}
              aria-label="Restart simulation"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
};
