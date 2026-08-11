import { cn } from "@/lib/utils";

/**
 * ClaudeDiff — Claude Code's inline edit hunk (the ⏺ Update / ⎿ summary + the
 * +/- lines). Added/removed rows carry semantic tinted backgrounds and an
 * off-screen "added"/"removed" label so the diff is legible without color.
 */
export interface DiffLine {
  type: "add" | "del" | "ctx";
  n?: number;
  text: string;
}

export const ClaudeDiff = ({
  file,
  summary,
  lines,
  className,
}: {
  file: string;
  summary?: string;
  lines: DiffLine[];
  className?: string;
}) => (
  <div className={cn("min-w-0 text-[13px] leading-[1.55]", className)}>
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span
        aria-hidden
        className="shrink-0 text-emerald-600 dark:text-[#4ea96f]"
      >
        ⏺
      </span>
      <span className="text-foreground font-medium">Update</span>
      <span className="min-w-0 font-mono break-all">
        <span className="text-muted-foreground">(</span>
        <span className="text-blue-600 dark:text-[#7dcfff]">{file}</span>
        <span className="text-muted-foreground">)</span>
      </span>
    </div>
    {summary ? (
      <div className="text-muted-foreground flex min-w-0 items-baseline gap-2">
        {/* invisible status glyph spacer: aligns ⎿ under "Update" */}
        <span aria-hidden className="invisible shrink-0">
          ⏺
        </span>
        <span aria-hidden className="text-muted-foreground/60 shrink-0">
          ⎿
        </span>
        <span className="wrap-break-words min-w-0">{summary}</span>
      </div>
    ) : null}

    <pre className="border-border bg-muted/30 mt-1 min-w-0 overflow-x-auto rounded-md border py-1.5 pr-3 pl-2">
      {lines.map((l) => {
        let mark = " ";
        if (l.type === "add") {
          mark = "+";
        } else if (l.type === "del") {
          mark = "-";
        }

        return (
          <div
            key={`${l.type}-${l.n ?? ""}-${l.text}`}
            className={cn(
              "flex min-w-0",
              l.type === "add" &&
                "bg-emerald-500/10 dark:bg-[rgba(78,169,111,.10)]",
              l.type === "del" &&
                "bg-rose-500/10 dark:bg-[rgba(247,118,142,.12)]",
              l.type === "ctx" && "bg-transparent"
            )}
          >
            <span className="text-muted-foreground/50 w-9 shrink-0 pr-2 text-right select-none">
              {l.n ?? ""}
            </span>
            <span
              className={cn(
                "w-3 shrink-0 select-none",
                l.type === "add" && "text-emerald-600 dark:text-[#4ea96f]",
                l.type === "del" && "text-rose-600 dark:text-[#f7768e]",
                l.type === "ctx" && "text-muted-foreground/60"
              )}
            >
              {mark}
            </span>
            <span
              className={cn(
                "min-w-0 font-mono break-all",
                l.type === "ctx" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {l.type === "ctx" ? null : (
                <span className="sr-only">
                  {l.type === "add" ? "added: " : "removed: "}
                </span>
              )}
              {l.text}
            </span>
          </div>
        );
      })}
    </pre>
  </div>
);
