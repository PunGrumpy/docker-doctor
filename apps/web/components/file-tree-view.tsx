"use client";

import { LazyMotion, domAnimation, m } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const CodePanel = ({ entry }: { entry: EntryData }) => {
  const lightRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.innerHTML = entry.codeHighlightedLight;
    }
    if (darkRef.current) {
      darkRef.current.innerHTML = entry.codeHighlightedDark;
    }
  }, [entry.codeHighlightedDark, entry.codeHighlightedLight]);

  return (
    <div key={entry.path} className="code-panel">
      <div ref={lightRef} className="dark:hidden" />
      <div ref={darkRef} className="hidden dark:block" />
    </div>
  );
};

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
    <div className="hidden sm:flex w-full min-h-0">
      <div className="w-[34%] shrink-0 py-2.5 pr-2 pl-1.5">
        {entries.map((entry, i) => (
          <button
            type="button"
            key={entry.path}
            onClick={() => onSelect(i)}
            className={cn(
              "flex items-center w-full text-left gap-2 rounded-sm px-1.5 py-[3px]",
              "transition-[transform,colors] duration-100 ease-out relative isolate",
              "hover:bg-muted/30",
              "active:scale-[0.98]"
            )}
          >
            {i === activeIndex && (
              <>
                <m.span
                  layoutId="active-bg-desktop"
                  className="absolute inset-0 bg-muted/40 rounded-sm -z-10"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
                <m.span
                  layoutId="active-indicator-desktop"
                  className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-foreground/70"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
              </>
            )}
            <span className="flex items-center justify-center size-4 shrink-0 text-muted-foreground/70 [&>svg]:size-full">
              {entry.icon}
            </span>
            <span
              className={cn(
                "font-mono text-[12px] tracking-tight transition-colors duration-100 ease-out truncate",
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

      <div className="flex-1 min-w-0 border-l border-dashed border-border/50">
        <div className="pl-5 py-3 pr-1">
          <CodePanel key={activeEntry.path} entry={activeEntry} />

          <div className="mt-3 pl-[calc(2ch+1.25rem)]">
            <p className="text-[13px] text-pretty text-muted-foreground leading-relaxed">
              {activeEntry.description}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/40">
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
    <div className="flex sm:hidden flex-col w-full">
      <div className="max-h-[40vh] overflow-y-auto border-b border-dashed border-border/50">
        <div className="py-1 px-0.5">
          {entries.map((entry, i) => (
            <button
              type="button"
              key={entry.path}
              onClick={() => onSelect(i)}
              className={cn(
                "flex items-center w-full text-left gap-2.5 rounded-lg px-2.5 min-h-10 relative isolate",
                "transition-[transform,colors] duration-100 ease-out",
                "active:scale-[0.98]",
                i !== activeIndex && "hover:bg-muted/20"
              )}
            >
              {i === activeIndex && (
                <m.span
                  layoutId="active-bg-mobile"
                  className="absolute inset-0 bg-muted/50 rounded-lg -z-10"
                  transition={{ damping: 30, stiffness: 380, type: "spring" }}
                />
              )}
              <span className="flex items-center justify-center size-4 shrink-0 text-muted-foreground/60 [&>svg]:size-full">
                {entry.icon}
              </span>
              <span
                className={cn(
                  "font-mono text-xs tracking-tight truncate flex-1",
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

      <div className="flex flex-col px-2.5 pt-3 pb-4 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="flex items-center justify-center size-4 shrink-0 text-muted-foreground/60 [&>svg]:size-full">
            {activeEntry.icon}
          </span>
          <span className="font-mono text-sm font-medium text-foreground">
            {activeEntry.label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/30 ml-auto">
            {activeEntry.path}
          </span>
        </div>

        <div className="-mx-2.5">
          <CodePanel key={activeEntry.path} entry={activeEntry} />
        </div>

        <p className="mt-3 text-xs text-pretty text-muted-foreground leading-relaxed px-0">
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
      <div className="flex flex-col w-full">
        <DesktopLayout
          entries={entries}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />

        <div className="sm:hidden">
          <MobileLayout
            entries={entries}
            activeIndex={activeIndex}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </LazyMotion>
  );
};
