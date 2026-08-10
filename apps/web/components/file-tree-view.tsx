"use client";

import { LazyMotion, domAnimation, m } from "motion/react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface EntryData {
  icon: ReactNode;
  label: string;
  path: string;
  description: string;
  codeHighlightedLight: string;
  codeHighlightedDark: string;
}

interface FileTreeViewProps {
  entries: EntryData[];
}

// The highlighted markup is generated at build time by shiki in a server
// component (trusted, not user input), so it can be inlined directly —
// this keeps the code in the server-rendered HTML instead of popping in
// after hydration via an effect.
const CodePanel = ({ entry }: { entry: EntryData }) => (
  <div className="code-panel scroll-fade max-h-[60vh] overflow-auto">
    <div
      className="dark:hidden"
      // oxlint-disable-next-line no-danger -- build-time shiki output
      dangerouslySetInnerHTML={{ __html: entry.codeHighlightedLight }}
    />
    <div
      className="hidden dark:block"
      // oxlint-disable-next-line no-danger -- build-time shiki output
      dangerouslySetInnerHTML={{ __html: entry.codeHighlightedDark }}
    />
  </div>
);

const DesktopLayout = ({
  entries,
  activeIndex,
  onSelect,
}: {
  entries: EntryData[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) => {
  const activeEntry = entries[activeIndex];

  return (
    <div className="hidden min-h-0 w-full sm:flex">
      <div className="w-[34%] shrink-0 py-2.5 pr-2 pl-1.5">
        {entries.map((entry, i) => (
          <button
            type="button"
            key={entry.path}
            onClick={() => onSelect(i)}
            aria-pressed={i === activeIndex}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-1.5 py-[3px] text-left",
              "relative isolate transition-[transform,colors] duration-100 ease-out",
              "hover:bg-muted/30",
              "active:scale-[0.98]"
            )}
          >
            {i === activeIndex && (
              <>
                <m.span
                  layoutId="active-bg-desktop"
                  className="bg-muted/40 absolute inset-0 -z-10 rounded-sm"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
                <m.span
                  layoutId="active-indicator-desktop"
                  className="bg-foreground/70 absolute top-1 bottom-1 left-0 w-[2px] rounded-full"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
              </>
            )}
            <span className="text-muted-foreground/70 flex size-4 shrink-0 items-center justify-center [&>svg]:size-full">
              {entry.icon}
            </span>
            <span
              className={cn(
                "truncate font-mono text-[12px] tracking-tight transition-colors duration-100 ease-out",
                i === activeIndex
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/80"
              )}
            >
              {entry.path}
            </span>
          </button>
        ))}
      </div>

      <div className="border-border/50 min-w-0 flex-1 border-l border-dashed">
        <div className="py-3 pr-1 pl-5">
          <CodePanel key={activeEntry.path} entry={activeEntry} />

          <div className="mt-3 pl-[calc(2ch+1.25rem)]">
            <p className="text-muted-foreground text-[13px] leading-relaxed text-pretty">
              {activeEntry.description}
            </p>
            <p className="text-muted-foreground/40 mt-0.5 font-mono text-[11px]">
              {activeEntry.label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileLayout = ({
  entries,
  activeIndex,
  onSelect,
}: {
  entries: EntryData[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) => {
  const activeEntry = entries[activeIndex];

  return (
    <div className="flex w-full flex-col sm:hidden">
      <div className="border-border/50 max-h-[40vh] overflow-y-auto border-b border-dashed">
        <div className="px-0.5 py-1">
          {entries.map((entry, i) => (
            <button
              type="button"
              key={entry.path}
              onClick={() => onSelect(i)}
              aria-pressed={i === activeIndex}
              className={cn(
                "relative isolate flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left",
                "transition-[transform,colors] duration-100 ease-out",
                "active:scale-[0.98]",
                i !== activeIndex && "hover:bg-muted/20"
              )}
            >
              {i === activeIndex && (
                <m.span
                  layoutId="active-bg-mobile"
                  className="bg-muted/50 absolute inset-0 -z-10 rounded-lg"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
              )}
              <span className="text-muted-foreground/60 flex size-4 shrink-0 items-center justify-center [&>svg]:size-full">
                {entry.icon}
              </span>
              <span
                className={cn(
                  "flex-1 truncate font-mono text-xs tracking-tight",
                  i === activeIndex
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/70"
                )}
              >
                {entry.path}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col overflow-y-auto px-2.5 pt-3 pb-4">
        <div className="mb-2.5 flex items-center gap-2">
          <span className="text-muted-foreground/60 flex size-4 shrink-0 items-center justify-center [&>svg]:size-full">
            {activeEntry.icon}
          </span>
          <span className="text-foreground font-mono text-sm font-medium">
            {activeEntry.label}
          </span>
          <span className="text-muted-foreground/30 ml-auto font-mono text-[10px]">
            {activeEntry.path}
          </span>
        </div>

        <div className="-mx-2.5">
          <CodePanel key={activeEntry.path} entry={activeEntry} />
        </div>

        <p className="text-muted-foreground mt-3 px-0 text-xs leading-relaxed text-pretty">
          {activeEntry.description}
        </p>
      </div>
    </div>
  );
};

export const FileTreeView = ({ entries }: FileTreeViewProps) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleSelect = useCallback((i: number) => {
    setActiveIndex(i);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <div className="flex w-full flex-col">
        <DesktopLayout
          entries={entries}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />

        <MobileLayout
          entries={entries}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />
      </div>
    </LazyMotion>
  );
};
