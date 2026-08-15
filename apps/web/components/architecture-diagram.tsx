import { AlertTriangle, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

// The diagram lives on a fixed coordinate canvas: the SVG uses it as its
// viewBox and every node is placed as a percentage of it, so curves and nodes
// scale together as long as the frame keeps the canvas' aspect ratio.
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 320;

const across = (value: number) => `${(value / CANVAS_WIDTH) * 100}%`;
const down = (value: number) => `${(value / CANVAS_HEIGHT) * 100}%`;

// Chrome the diagram draws at a fixed size…
const place = (x: number, y: number, width: number, height: number) => ({
  height: down(height),
  left: across(x),
  top: down(y),
  width: across(width),
});

// …and nodes whose box has to grow when their text does.
const placeGrowable = (
  x: number,
  y: number,
  width: number,
  minHeight: number
) => ({
  left: across(x),
  minHeight: down(minHeight),
  top: down(y),
  width: across(width),
});

const anchor = (x: number, y: number) => ({ left: across(x), top: down(y) });

const PROJECT = place(0, 40, 130, 240);
const DECISION = place(207, 143, 145, 34);
const CLEAN = placeGrowable(400, 66, 200, 60);
const ISSUES = placeGrowable(400, 194, 200, 60);

const SCAN_PATH = "M130,160 C168,160 168,160 207,160";
const CLEAN_PATH = "M352,160 C376,160 376,96 400,96";
const ISSUES_PATH = "M352,160 C376,160 376,224 400,224";

// The second route draws after the first, in both the time-based and the
// scroll-driven form of the entrance.
const LATE_BEAM = {
  "--beam-delay": "0.35s",
  "--beam-end": "50%",
  "--beam-start": "25%",
} as CSSProperties;

const OUTCOMES = [
  {
    active: false,
    box: CLEAN,
    detail: "score 94 · exit 0",
    icon: Check,
    label: "No errors",
    labelAt: anchor(376, 128),
    route: "no",
  },
  {
    active: true,
    box: ISSUES,
    detail: "score 71 · exit 1",
    icon: AlertTriangle,
    label: "2 errors found",
    labelAt: anchor(376, 192),
    route: "yes",
  },
];

const routeChip = (active: boolean) =>
  cn(
    "rounded-full px-2.5 py-0.5 text-center text-[11px] leading-tight",
    active
      ? "bg-foreground text-background"
      : "bg-background text-muted-foreground shadow-border"
  );

const ProjectCard = ({
  className,
  style,
}: {
  readonly className?: string;
  readonly style?: CSSProperties;
}) => (
  <div
    className={cn(
      "border-border bg-card flex flex-col overflow-hidden rounded-2xl border",
      className
    )}
    style={style}
  >
    <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
      <span className="bg-muted-foreground/25 size-2 rounded-full" />
      <span className="bg-muted-foreground/25 size-2 rounded-full" />
      <span className="bg-muted-foreground/25 size-2 rounded-full" />
    </div>
    <div className="flex flex-col gap-3 px-3 pt-1">
      <span className="text-muted-foreground text-2xl font-semibold tracking-tight">
        my-app
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="bg-muted-foreground/15 h-2 w-[78%] rounded-md" />
        <span className="bg-muted-foreground/15 h-2 w-[60%] rounded-md" />
      </div>
      <span className="bg-muted-foreground/15 h-10 w-full rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <span className="bg-muted-foreground/15 h-2 w-[70%] rounded-md" />
        <span className="bg-muted-foreground/15 h-2 w-[52%] rounded-md" />
      </div>
    </div>
  </div>
);

const DecisionPill = ({
  className,
  style,
}: {
  readonly className?: string;
  readonly style?: CSSProperties;
}) => (
  <div
    className={cn(
      "bg-background flex items-center justify-center rounded-full px-3 shadow-[0_0_0_1px_var(--color-foreground)]",
      className
    )}
    style={style}
  >
    <span className="text-foreground text-[11px] whitespace-nowrap">
      Error-level issue?
    </span>
  </div>
);

const OutcomeCard = ({
  active,
  className,
  detail,
  icon: Icon,
  label,
  style,
}: {
  readonly active: boolean;
  readonly className?: string;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly style?: CSSProperties;
}) => (
  <div
    className={cn(
      "bg-card flex items-center gap-2 rounded-lg px-2.5 py-2.5",
      active
        ? "shadow-[0_0_0_1px_var(--color-foreground)]"
        : "shadow-custom text-muted-foreground",
      className
    )}
    style={style}
  >
    <Icon
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        active ? "text-foreground" : "text-muted-foreground/60"
      )}
    />
    <div className="flex min-w-0 flex-col">
      <span
        className={cn(
          "truncate text-[12px] font-medium",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className="text-muted-foreground truncate font-mono text-[11px]">
        {detail}
      </span>
    </div>
  </div>
);

const RouteLabel = ({
  active,
  children,
  style,
}: {
  readonly active: boolean;
  readonly children: string;
  readonly style: { left: string; top: string };
}) => (
  <span
    className={cn(
      "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2",
      routeChip(active)
    )}
    style={style}
  >
    {children}
  </span>
);

const Routes = () => (
  <svg
    aria-hidden="true"
    className="text-foreground absolute inset-0 size-full"
    fill="none"
    viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
  >
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="dd-beam-scan"
        x1="130"
        x2="207"
        y1="160"
        y2="160"
      >
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.2" stopColor="currentColor" stopOpacity="1" />
        <stop offset="0.8" stopColor="currentColor" stopOpacity="1" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="dd-beam-issues"
        x1="352"
        x2="400"
        y1="160"
        y2="224"
      >
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.2" stopColor="currentColor" stopOpacity="1" />
        <stop offset="0.8" stopColor="currentColor" stopOpacity="1" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>

    <path
      className="stroke-muted-foreground/35"
      d={SCAN_PATH}
      strokeWidth={1.5}
    />
    <path
      className="route-beam"
      d={SCAN_PATH}
      pathLength={1}
      stroke="url(#dd-beam-scan)"
      strokeDasharray={1}
      strokeLinecap="round"
      strokeWidth={1.5}
    />

    <path
      className="stroke-muted-foreground/30"
      d={CLEAN_PATH}
      strokeDasharray="4 4"
      strokeWidth={1.5}
    />

    <path
      className="stroke-muted-foreground/35"
      d={ISSUES_PATH}
      strokeWidth={1.5}
    />
    <path
      className="route-beam"
      d={ISSUES_PATH}
      pathLength={1}
      stroke="url(#dd-beam-issues)"
      strokeDasharray={1}
      strokeLinecap="round"
      strokeWidth={1.5}
      style={LATE_BEAM}
    />
  </svg>
);

// Phones get the same nodes stacked, each branch keeping its route label.
const StackedFlow = () => (
  <div className="flex flex-col items-center gap-3 sm:hidden">
    <ProjectCard className="h-40 w-40 [mask-image:linear-gradient(to_bottom,#000_58%,transparent_96%)]" />
    <span aria-hidden="true" className="h-5 border-l border-dashed" />
    <DecisionPill className="h-9" />
    <span aria-hidden="true" className="h-5 border-l border-dashed" />
    <div className="flex w-full max-w-64 flex-col gap-3">
      {OUTCOMES.map((outcome) => (
        <div className="flex flex-col gap-1.5" key={outcome.label}>
          <span className={cn("w-fit", routeChip(outcome.active))}>
            {outcome.route}
          </span>
          <OutcomeCard
            active={outcome.active}
            detail={outcome.detail}
            icon={outcome.icon}
            label={outcome.label}
          />
        </div>
      ))}
    </div>
  </div>
);

export const ArchitectureDiagram = () => (
  <figure className="shadow-border relative isolate overflow-hidden rounded-xl px-4 py-8 sm:px-6">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [background-image:radial-gradient(oklch(from_var(--color-muted-foreground)_l_c_h/0.3)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,#000_45%,transparent_82%)] [background-size:20px_20px]"
    />

    <StackedFlow />

    <div
      className="relative hidden w-full sm:block"
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
    >
      <Routes />

      <ProjectCard
        className="absolute [mask-image:linear-gradient(to_bottom,#000_56%,transparent_96%)]"
        style={PROJECT}
      />
      <DecisionPill className="absolute" style={DECISION} />

      {/* Each route label precedes the card it labels, so the branches survive
          linearized reading. */}
      {OUTCOMES.map((outcome) => (
        <Fragment key={outcome.label}>
          <RouteLabel active={outcome.active} style={outcome.labelAt}>
            {outcome.route}
          </RouteLabel>
          <OutcomeCard
            active={outcome.active}
            className="absolute"
            detail={outcome.detail}
            icon={outcome.icon}
            label={outcome.label}
            style={outcome.box}
          />
        </Fragment>
      ))}
    </div>

    <figcaption className="text-muted-foreground relative mt-6 text-center text-[11px] text-balance">
      25 rules across five categories. Errors fail the build;{" "}
      <code className="font-mono">--score</code> fails below 50.{" "}
      <Link
        className="underline underline-offset-2"
        data-track="architecture_scoring_docs_clicked"
        href="/docs/reference/scoring"
      >
        How scoring works <span aria-hidden="true">→</span>
      </Link>
    </figcaption>
  </figure>
);
