import { AlertTriangle, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

// Each layout is a fixed coordinate canvas: the SVG uses it as its viewBox and
// every node is placed as a percentage of it, so curves and nodes scale
// together as long as the frame keeps the canvas' aspect ratio. Phones get the
// portrait canvas, everything else the landscape one — same nodes, same
// routes, re-laid out rather than reduced.
interface Canvas {
  height: number;
  width: number;
}

interface Box {
  height?: string;
  left: string;
  minHeight?: string;
  top: string;
  width: string;
}

interface Anchor {
  left: string;
  top: string;
}

interface Gradient {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface Layout {
  canvas: Canvas;
  cleanPath: string;
  decision: Box;
  id: string;
  issuesGradient: Gradient;
  issuesPath: string;
  labels: Anchor[];
  outcomes: Box[];
  project: Box;
  scanGradient: Gradient;
  scanPath: string;
}

const across = (canvas: Canvas, value: number) =>
  `${(value / canvas.width) * 100}%`;
const down = (canvas: Canvas, value: number) =>
  `${(value / canvas.height) * 100}%`;

// Chrome the diagram draws at a fixed size…
const place = (
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number
): Box => ({
  height: down(canvas, height),
  left: across(canvas, x),
  top: down(canvas, y),
  width: across(canvas, width),
});

// …and nodes whose box has to grow when their text does.
const placeGrowable = (
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  minHeight: number
): Box => ({
  left: across(canvas, x),
  minHeight: down(canvas, minHeight),
  top: down(canvas, y),
  width: across(canvas, width),
});

const anchor = (canvas: Canvas, x: number, y: number): Anchor => ({
  left: across(canvas, x),
  top: down(canvas, y),
});

const WIDE: Canvas = { height: 320, width: 600 };
const TALL: Canvas = { height: 470, width: 320 };

const LANDSCAPE: Layout = {
  canvas: WIDE,
  cleanPath: "M352,160 C376,160 376,96 400,96",
  decision: place(WIDE, 207, 143, 145, 34),
  id: "wide",
  issuesGradient: { x1: 352, x2: 400, y1: 160, y2: 224 },
  issuesPath: "M352,160 C376,160 376,224 400,224",
  labels: [anchor(WIDE, 376, 128), anchor(WIDE, 376, 192)],
  outcomes: [
    placeGrowable(WIDE, 400, 66, 200, 60),
    placeGrowable(WIDE, 400, 194, 200, 60),
  ],
  project: place(WIDE, 0, 40, 130, 240),
  scanGradient: { x1: 130, x2: 207, y1: 160, y2: 160 },
  scanPath: "M130,160 C168,160 168,160 207,160",
};

// The clean branch lands on a card pinned left; the issues branch runs down the
// free corridor to its right, so neither curve crosses a card.
const PORTRAIT: Layout = {
  canvas: TALL,
  cleanPath: "M160,242 C160,270 115,272 115,300",
  decision: place(TALL, 82, 210, 156, 32),
  id: "tall",
  issuesGradient: { x1: 160, x2: 290, y1: 242, y2: 390 },
  issuesPath: "M160,242 C220,250 290,300 290,390",
  labels: [anchor(TALL, 137, 271), anchor(TALL, 248, 285)],
  outcomes: [
    placeGrowable(TALL, 0, 300, 230, 60),
    placeGrowable(TALL, 90, 390, 230, 60),
  ],
  project: place(TALL, 75, 0, 170, 170),
  scanGradient: { x1: 160, x2: 160, y1: 170, y2: 210 },
  scanPath: "M160,170 C160,190 160,190 160,210",
};

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
    detail: "score 94 · exit 0",
    icon: Check,
    label: "No errors",
    route: "no",
  },
  {
    active: true,
    detail: "score 71 · exit 1",
    icon: AlertTriangle,
    label: "2 errors found",
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

const ProjectCard = ({ style }: { readonly style: Box }) => (
  <div
    className="border-border bg-card absolute flex flex-col overflow-hidden rounded-2xl border [mask-image:linear-gradient(to_bottom,#000_56%,transparent_96%)]"
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

const DecisionPill = ({ style }: { readonly style: Box }) => (
  <div
    className="bg-background absolute flex items-center justify-center rounded-full px-3 shadow-[0_0_0_1px_var(--color-foreground)]"
    style={style}
  >
    <span className="text-foreground text-[11px] whitespace-nowrap">
      Error-level issue?
    </span>
  </div>
);

const OutcomeCard = ({
  active,
  detail,
  icon: Icon,
  label,
  style,
}: {
  readonly active: boolean;
  readonly detail: string;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly style: Box;
}) => (
  <div
    className={cn(
      "bg-card absolute flex items-center gap-2 rounded-lg px-2.5 py-2.5",
      active
        ? "shadow-[0_0_0_1px_var(--color-foreground)]"
        : "shadow-custom text-muted-foreground"
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
  readonly style: Anchor;
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

const BeamGradient = ({
  bounds,
  id,
}: {
  readonly bounds: Gradient;
  readonly id: string;
}) => (
  <linearGradient
    gradientUnits="userSpaceOnUse"
    id={id}
    x1={bounds.x1}
    x2={bounds.x2}
    y1={bounds.y1}
    y2={bounds.y2}
  >
    <stop offset="0" stopColor="currentColor" stopOpacity="0" />
    <stop offset="0.2" stopColor="currentColor" stopOpacity="1" />
    <stop offset="0.8" stopColor="currentColor" stopOpacity="1" />
    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
  </linearGradient>
);

const Routes = ({ layout }: { readonly layout: Layout }) => (
  <svg
    aria-hidden="true"
    className="text-foreground absolute inset-0 size-full"
    fill="none"
    viewBox={`0 0 ${layout.canvas.width} ${layout.canvas.height}`}
  >
    <defs>
      <BeamGradient bounds={layout.scanGradient} id={`dd-scan-${layout.id}`} />
      <BeamGradient
        bounds={layout.issuesGradient}
        id={`dd-issues-${layout.id}`}
      />
    </defs>

    <path
      className="stroke-muted-foreground/35"
      d={layout.scanPath}
      strokeWidth={1.5}
    />
    <path
      className="route-beam"
      d={layout.scanPath}
      pathLength={1}
      stroke={`url(#dd-scan-${layout.id})`}
      strokeDasharray={1}
      strokeLinecap="round"
      strokeWidth={1.5}
    />

    <path
      className="stroke-muted-foreground/30"
      d={layout.cleanPath}
      strokeDasharray="4 4"
      strokeWidth={1.5}
    />

    <path
      className="stroke-muted-foreground/35"
      d={layout.issuesPath}
      strokeWidth={1.5}
    />
    <path
      className="route-beam"
      d={layout.issuesPath}
      pathLength={1}
      stroke={`url(#dd-issues-${layout.id})`}
      strokeDasharray={1}
      strokeLinecap="round"
      strokeWidth={1.5}
      style={LATE_BEAM}
    />
  </svg>
);

const DiagramCanvas = ({
  className,
  layout,
}: {
  readonly className: string;
  readonly layout: Layout;
}) => (
  <div
    className={cn("relative w-full", className)}
    style={{ aspectRatio: `${layout.canvas.width} / ${layout.canvas.height}` }}
  >
    <Routes layout={layout} />

    <ProjectCard style={layout.project} />
    <DecisionPill style={layout.decision} />

    {/* Each route label precedes the card it labels, so the branches survive
        linearized reading. */}
    {OUTCOMES.map((outcome, index) => (
      <Fragment key={outcome.label}>
        <RouteLabel active={outcome.active} style={layout.labels[index]}>
          {outcome.route}
        </RouteLabel>
        <OutcomeCard
          active={outcome.active}
          detail={outcome.detail}
          icon={outcome.icon}
          label={outcome.label}
          style={layout.outcomes[index]}
        />
      </Fragment>
    ))}
  </div>
);

export const ArchitectureDiagram = () => (
  <figure className="shadow-border relative isolate overflow-hidden rounded-xl px-4 py-8 sm:px-6">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [background-image:radial-gradient(oklch(from_var(--color-muted-foreground)_l_c_h/0.3)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,#000_45%,transparent_82%)] [background-size:20px_20px]"
    />

    <DiagramCanvas className="sm:hidden" layout={PORTRAIT} />
    <DiagramCanvas className="hidden sm:block" layout={LANDSCAPE} />

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
