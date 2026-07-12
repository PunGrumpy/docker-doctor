"use client";

import { Play, Pause, RotateCcw, Check, AlertTriangle } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { ClaudeCode } from "@/components/icons/claude-code";
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
    <span className="w-2 h-4 bg-foreground inline-block animate-pulse shrink-0" />
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
      <div className="flex items-center gap-2 text-foreground">
        <span className="text-emerald-500 font-bold select-none">$</span>
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
            <span className="text-cyan-500 font-bold">{currentSpinner}</span>
            <span>
              {ticks < 23 && "Discovering workspace..."}
              {ticks >= 23 && ticks < 29 && "Analyzing 1 Dockerfile(s)..."}
              {ticks >= 29 && "Analyzing 1 Compose file(s)..."}
            </span>
          </div>
        ) : (
          <div className="text-emerald-500 flex items-center gap-2">
            <Check className="size-3.5 text-emerald-500" />
            <span>Scanning files completed!</span>
          </div>
        )}
      </div>

      {ticks >= 36 && (
        <div className="flex flex-col gap-1 transition-opacity duration-200 stagger-enter">
          <div className="font-semibold text-foreground">Found 3 issue(s):</div>
          <div className="text-yellow-600 dark:text-yellow-400 pl-4 flex items-center gap-2">
            <AlertTriangle className="size-3.5" />
            <span>Security › 1 warning</span>
          </div>
          <div className="text-yellow-600 dark:text-yellow-400 pl-4 flex items-center gap-2">
            <AlertTriangle className="size-3.5" />
            <span>Best Practices › 1 warning</span>
          </div>
        </div>
      )}

      {ticks >= 56 && (
        <div className="space-y-4">
          <div
            className="underline font-bold text-foreground stagger-enter"
            style={{ animationDelay: "0ms" }}
          >
            Dockerfile
          </div>

          <div
            className="border border-yellow-500/25 bg-yellow-500/5 rounded-xl p-4 space-y-2 stagger-enter"
            style={{ animationDelay: "50ms" }}
          >
            <div className="flex items-center justify-between text-yellow-600 dark:text-yellow-400 font-bold">
              <span>⚠ WARN [docker-doctor/pin-image-version]:1</span>
            </div>
            <div className="pl-4 border-l-2 border-yellow-500/40 text-muted-foreground text-xs leading-relaxed space-y-1">
              <div className="flex font-mono">
                <span className="text-muted-foreground/45 select-none w-10">
                  {" "}
                  1 │{" "}
                </span>
                <span className="text-foreground">FROM node:latest</span>
              </div>
              <div className="flex font-mono opacity-50">
                <span className="text-muted-foreground/45 select-none w-10">
                  {" "}
                  2 │{" "}
                </span>
                <span>COPY . .</span>
              </div>
            </div>
            <div className="text-xs text-foreground font-medium pl-4">
              Base image &apos;node&apos; uses the mutable &apos;latest&apos;
              tag. This makes builds non-deterministic.
            </div>
            <div className="text-xs text-muted-foreground pl-4">
              <span className="font-semibold text-foreground">Help:</span>{" "}
              Specify a concrete tag instead of &apos;latest&apos; or no tag
              (e.g., &apos;node:22.2.0-alpine&apos;).
            </div>
          </div>

          <div
            className="border bg-muted/10 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center stagger-enter"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex flex-col font-mono text-red-500/80 dark:text-red-500/60 leading-none font-bold text-center sm:text-left shrink-0">
              <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              <span>&nbsp;.---.&nbsp;&nbsp;</span>
              <span>(&nbsp;x&nbsp;x&nbsp;)&gt;</span>
              <span>&nbsp;\___/&nbsp;&nbsp;</span>
            </div>
            <div className="flex-1 w-full space-y-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-red-500 dark:text-red-400 font-mono tabular-nums">
                  45 / 100
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Needs work
                </span>
              </div>
              <div className="w-full overflow-hidden text-[11px] select-none text-left">
                {getProgressBar(45)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Docker Doctor (https://github.com/PunGrumpy/docker-doctor)
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
    <div className="space-y-4 flex flex-col items-start gap-4">
      <div
        className="flex w-full flex-col text-[#F76038] font-sans stagger-enter"
        style={{ animationDelay: "0ms" }}
      >
        <div className="flex items-stretch h-3">
          <div className="w-5 shrink-0 rounded-tl-[10px] border-l border-t border-[#F76038]" />
          <div className="px-2 text-xs font-semibold select-none leading-none transform -translate-y-1/2">
            Claude Code v2.1
          </div>
          <div className="flex-1 rounded-tr-[10px] border-r border-t border-[#F76038]" />
        </div>
        <div className="flex flex-col items-start gap-1.5 rounded-b-[10px] border-x border-b border-[#F76038] px-5 pt-3 pb-4">
          <ClaudeCode className="h-auto w-16 shrink-0" aria-hidden="true" />
          <div className="pt-1 text-[#424242] dark:text-[#C6C6C6] text-xs font-semibold">
            Fable 5
          </div>
          <div className="text-[#909090] dark:text-[#6E6E6E] text-[10px]">
            ~/Developer/project
          </div>
        </div>
      </div>

      <div
        className="w-full border-b border-solid border-border stagger-enter"
        style={{ animationDelay: "50ms" }}
      />

      <div
        className="w-full overflow-hidden border border-solid border-border py-4 rounded-xl stagger-enter"
        style={{ animationDelay: "100ms" }}
      >
        <div className="text-xs font-mono leading-[160%]">
          <div className="whitespace-pre border-l-2 border-l-transparent pl-4 pr-5 opacity-50">
            <span className="text-muted-foreground/45 select-none w-10 inline-block text-right pr-2" />
            <span className="text-muted-foreground/45 select-none">
              # Dockerfile
            </span>
          </div>
          <div className="whitespace-pre border-l-2 pl-4 pr-5 bg-[#FF3B3014] border-l-[#FF3B30] dark:bg-[#FF453A24] dark:border-l-[#FF453A]">
            <span className="text-[#C9303C] dark:text-[#FF7A85]">
              - 1 │ FROM node:latest
            </span>
          </div>
          <div className="whitespace-pre border-l-2 pl-4 pr-5 bg-[#34C75914] border-l-[#34C759] dark:bg-[#30D15824] dark:border-l-[#30D158]">
            <span className="text-[#1F8A43] dark:text-[#4ADE80]">
              + 1 │ FROM node:22.2.0-alpine
            </span>
          </div>
          <div className="whitespace-pre border-l-2 border-l-transparent pl-4 pr-5 opacity-50">
            <span className="text-muted-foreground/45 select-none w-10 inline-block text-right pr-2">
              2 │{" "}
            </span>
            <span className="text-foreground">COPY . .</span>
          </div>
          <div className="whitespace-pre border-l-2 border-l-transparent pl-4 pr-5 opacity-50">
            <span className="text-muted-foreground/45 select-none w-10 inline-block text-right pr-2">
              3 │{" "}
            </span>
            <span className="text-foreground">RUN npm install</span>
          </div>
          <div className="whitespace-pre border-l-2 pl-4 pr-5 bg-[#34C75914] border-l-[#34C759] dark:bg-[#30D15824] dark:border-l-[#30D158]">
            <span className="text-[#1F8A43] dark:text-[#4ADE80]">
              + 4 │ USER node
            </span>
          </div>
          <div className="whitespace-pre border-l-2 border-l-transparent pl-4 pr-5 opacity-50">
            <span className="text-muted-foreground/45 select-none w-10 inline-block text-right pr-2">
              5 │{" "}
            </span>
            <span className="text-foreground">
              CMD [&quot;npm&quot;, &quot;start&quot;]
            </span>
          </div>
        </div>
      </div>

      <div
        className="whitespace-nowrap text-[#424242] dark:text-[#C6C6C6] text-xs flex items-center gap-1.5 stagger-enter"
        style={{ animationDelay: "150ms" }}
      >
        <span className="inline-block w-[1ch] text-center text-[#909090] dark:text-[#6E6E6E]">
          ✻
        </span>
        <span>Cooked for 4s</span>
      </div>
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
          <span className="text-cyan-500 font-bold">{currentSpinner}</span>
          <span>Analyzing workspace...</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            className="border border-emerald-500/25 bg-emerald-500/5 rounded-xl p-4 flex items-start gap-3 stagger-enter"
            style={{ animationDelay: "0ms" }}
          >
            <Check className="size-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                ✔ No issues found! Your Docker setup looks healthy.
              </div>
              <div className="text-xs text-muted-foreground text-wrap-pretty">
                Verified building with Docker engine. All safety, performance,
                and best practices rules passed successfully.
              </div>
            </div>
          </div>

          <div
            className="flex flex-col items-start gap-1 font-mono text-sm leading-relaxed text-muted-foreground stagger-enter"
            style={{ animationDelay: "50ms" }}
          >
            <div className="text-foreground font-semibold">
              ✅ All issues fixed
            </div>
            <div className="flex items-center gap-1.5">
              <span>Docker Doctor score:</span>
              <span className="relative inline-block whitespace-nowrap font-bold">
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -inset-x-[3px] origin-left bg-muted/40 dark:bg-muted/30"
                />
                <span className="relative text-foreground dark:text-foreground">
                  100/100
                </span>
              </span>
            </div>
          </div>

          <div
            className="border bg-muted/10 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center stagger-enter"
            style={{ animationDelay: "100ms" }}
          >
            <div className="flex flex-col font-mono text-emerald-500/80 dark:text-emerald-500/60 leading-none font-bold text-center sm:text-left shrink-0">
              <span className="text-cyan-500/80">
                &nbsp;&nbsp;&quot;:&quot;&nbsp;&nbsp;&nbsp;
              </span>
              <span>&nbsp;.---.&nbsp;&nbsp;</span>
              <span>(&nbsp;◠&nbsp;◠&nbsp;)&gt;</span>
              <span>&nbsp;\___/&nbsp;&nbsp;</span>
            </div>
            <div className="flex-1 w-full space-y-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-emerald-500 dark:text-emerald-400 font-mono tabular-nums">
                  100 / 100
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  Healthy
                </span>
              </div>
              <div className="w-full overflow-hidden text-[11px] select-none text-left">
                {getProgressBar(100)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                Docker Doctor (https://github.com/PunGrumpy/docker-doctor)
              </div>
            </div>
          </div>

          <div
            className="text-xs text-muted-foreground/60 italic pt-2 text-center select-none flex items-center justify-center gap-1.5 stagger-enter"
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
    <Section className="pt-8 pb-16 lg:pb-32 flex flex-col items-center w-full">
      <div className="relative w-full max-w-2xl bg-card rounded-3xl shadow-border overflow-hidden">
        <div className="flex items-center justify-center w-full h-[45px] shrink-0 relative border-b border-b-[#EBEBEB] dark:border-b-[#1f1f1f] select-none">
          <div className="text-[17px] leading-[145%] text-center w-max font-medium text-[#6E6E6E] dark:text-[#7A7A7A]">
            Terminal - 592x648
          </div>
          <div className="flex items-start gap-2 w-fit absolute left-[18px] top-[15px]">
            <div className="size-[17px] rounded-full shrink-0 bg-[oklch(71.3%_0.171_26)] dark:bg-[#323232]" />
            <div className="size-[17px] rounded-full shrink-0 bg-[oklch(82.5%_0.159_80.9)] dark:bg-[#323232]" />
            <div className="size-[17px] rounded-full shrink-0 bg-[oklch(88.4%_0_0)] dark:bg-[#323232]" />
          </div>
        </div>

        <div className="flex w-full h-[38px] shrink-0 select-none">
          <div className="flex items-center justify-center h-[38px] border-b border-b-[#EBEBEB] dark:border-b-[#1f1f1f] flex-1">
            <span className="text-[16px] leading-[145%] text-center shrink-0 font-medium text-[#464646] dark:text-[#F1F1F1]">
              docker-doctor
            </span>
          </div>
          <div className="flex items-center justify-center w-10 h-[38px] shrink-0 bg-[#F9F9F9] border-l border-l-[#EBEBEB] border-b border-b-[#EBEBEB] dark:bg-[#08090a] dark:border-l-[#1f1f1f] dark:border-b-[#1f1f1f]">
            <Plus
              className="size-5 text-[#AFAFAF] shrink-0"
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          ref={terminalBodyRef}
          className="p-6 font-mono text-sm sm:text-[13px] leading-relaxed h-[500px] overflow-hidden bg-card select-text antialiased space-y-4"
        >
          <div className="flex items-center gap-2 text-foreground">
            <span className="text-emerald-500 font-bold select-none">$</span>
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

        <div className="flex items-center justify-between px-5 py-3.5 border-t bg-muted/20 dark:bg-muted/5 text-xs select-none">
          <div className="text-muted-foreground/60 font-mono flex items-center gap-2">
            <span>Tick:</span>
            <span className="font-semibold tabular-nums w-8 text-foreground">
              {ticks}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className={cn(
                "flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border font-medium",
                "bg-card hover:bg-muted/40",
                "active:scale-[0.96] transition-[transform,background-color,border-color] duration-150 ease-out"
              )}
              aria-label={isPaused ? "Play simulation" : "Pause simulation"}
            >
              {isPaused ? (
                <>
                  <Play className="size-3.5 fill-foreground" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="size-3.5 fill-foreground" />
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
                "flex items-center justify-center size-9 rounded-lg border bg-card hover:bg-muted/40",
                "active:scale-[0.96] transition-[transform,background-color,border-color] duration-150 ease-out"
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
