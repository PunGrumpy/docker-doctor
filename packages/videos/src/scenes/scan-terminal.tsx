import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// The two scan terminal scenes, sharing one frosted-card renderer — modeled
// on blume's audit-terminal:
//   ScanReport — `docker-doctor .` prints the findings report (grouped by
//   file, exactly the shape the real CLI prints, mascot scorecard included).
//   ScanAgent — `claude` picks up the findings (startup banner and the echoed
//   fix prompt), works through them, then the re-scan goes green.

const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";

const INK = "rgba(0,0,0,0.85)";
const MUTED = "rgba(0,0,0,0.55)";
const FAINT = "rgba(0,0,0,0.34)";
const ACCENT = "#2563eb";
const ERROR = "#d64545";
const WARNING = "#b45309";
const GREEN = "#1a9950";
const CLAUDE = "#cd694a";
const CHROME_BORDER = "rgba(90,100,120,0.14)";

const CARD_W = 960;
const CARD_H = 564;
const CHROME_H = 40;
const PAD_X = 26;
const PAD_TOP = 12;
const PAD_BOTTOM = 18;
const LINE_H = 23;
const VIEW_H = CARD_H - CHROME_H - PAD_TOP - PAD_BOTTOM;
// Block heights for the fixed-size inserts — the scroll math and the layout
// must agree exactly (the wrappers are sized to these).
const BANNER_H = 104;
const PROMPT_H = 314;
const SCORE_H = 96;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CHARS_PER_FRAME = 2;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Severity = "error" | "warning";

interface TermLine {
  kind:
    | "cmd"
    | "blank"
    | "header"
    | "summary"
    | "category"
    | "finding"
    | "code"
    | "fix"
    | "hand"
    | "banner"
    | "prompt"
    | "working"
    | "ok"
    | "score";
  text?: string;
  /** header: the dim workspace tail; finding: the dim rule key. */
  meta?: string;
  /** code lines: the dim `file:line` that the finding points at. */
  file?: string;
  severity?: Severity;
  /** score rows: the number, verdict, and meter fill. */
  score?: { value: number; verdict: string; healthy: boolean };
  /** Frames after the previous line finishes before this one lands. */
  delay: number;
  /** Extra hold after this line, before the next starts. */
  pause?: number;
}

// The Claude Code session it opens — the startup banner and the echoed agent
// prompt, mirroring the `docker-doctor` skill's fix instructions.
const CLAUDE_BANNER = {
  rows: [
    { label: "model:     ", value: "Fable 5 · max effort" },
    { label: "directory: ", value: "~/PunGrumpy" },
  ],
  title: "✻ Claude Code (v2.1)",
};

const CLAUDE_PROMPT: string[][] = [
  ["Fix the issues found by `docker-doctor` in this project."],
  [
    "The full report is at report.json. Each entry in `diagnostics` is one finding, with the rule `key`, a `message` explaining what is wrong, the affected `file` and `line`, and a `help` string describing the fix.",
  ],
  [
    "Work through every finding:",
    "1. Read the report and group the findings by file.",
    "2. Apply each finding's `help` by editing the Dockerfile or Compose file at the cited line.",
    "3. Never fix a finding by deleting the file or suppressing the rule; if something needs a human decision, leave it and say so.",
  ],
  [
    "When you are done, run `docker-doctor .` to verify, and repeat until the scan reports no issues.",
  ],
];

const REPORT_HEADER_META = "1 Dockerfile · 1 Compose file · 30 rules";
const REPORT_SUMMARY = "60 checks · 1 error · 2 warnings";

// Scene 1's script. Copy mirrors the real CLI report — real rule keys from
// packages/core/src/rules, real help strings, counts that add up (1 error +
// 2 warnings = the 3 findings handed off later).
const REPORT_LINES: TermLine[] = [
  { delay: 16, kind: "cmd", text: "docker-doctor ." },
  { delay: 10, kind: "blank" },
  { delay: 0, kind: "header", meta: REPORT_HEADER_META },
  { delay: 3, kind: "summary", text: REPORT_SUMMARY },
  { delay: 3, kind: "blank" },
  { delay: 2, kind: "category", text: "Dockerfile" },
  {
    delay: 3,
    kind: "finding",
    meta: "pin-image-version",
    severity: "error",
    text: "Base image uses the mutable 'latest' tag",
  },
  {
    delay: 2,
    file: "Dockerfile:1",
    kind: "code",
    text: "1 │ FROM node:latest",
  },
  {
    delay: 2,
    kind: "fix",
    text: "fix: Pin a concrete tag (e.g. 'node:22.2.0-alpine').",
  },
  {
    delay: 4,
    kind: "finding",
    meta: "no-root-user",
    severity: "warning",
    text: "Container runs as root",
  },
  {
    delay: 2,
    kind: "fix",
    text: "fix: Add a USER instruction (e.g. 'USER node').",
  },
  {
    delay: 4,
    kind: "finding",
    meta: "order-layers",
    severity: "warning",
    text: "COPY . . before install busts the build cache",
  },
  {
    delay: 2,
    kind: "fix",
    text: "fix: Copy manifests first, install, then copy source.",
  },
  { delay: 4, kind: "blank" },
  {
    delay: 4,
    kind: "score",
    pause: 26,
    score: { healthy: false, value: 45, verdict: "Needs work" },
  },
];

// Scene 2's script: the handoff — Claude Code opens, receives the fix prompt,
// works through the findings, then the re-scan goes green.
const AGENT_LINES: TermLine[] = [
  { delay: 16, kind: "cmd", text: "claude" },
  { delay: 10, kind: "blank" },
  { delay: 4, kind: "hand", text: "Handing 3 findings to Claude…" },
  { delay: 8, kind: "banner", pause: 10 },
  { delay: 6, kind: "prompt", pause: 20 },
  { delay: 8, kind: "blank" },
  // The spinner runs through the pause — the beat where the agent works —
  // and settles when the completion line lands.
  { delay: 0, kind: "working", pause: 70, text: "Fixing 3 issues…" },
  { delay: 8, kind: "ok", text: "✔ All issues fixed" },
  { delay: 10, kind: "blank" },
  { delay: 4, kind: "cmd", text: "docker-doctor ." },
  { delay: 10, kind: "ok", text: "✔ No issues found" },
  {
    delay: 6,
    kind: "score",
    pause: 24,
    score: { healthy: true, value: 100, verdict: "Healthy" },
  },
];

/** Frames a line spends arriving: cmd lines type, output lines just land. */
const arrival = (line: TermLine): number =>
  line.kind === "cmd"
    ? Math.ceil((line.text?.length ?? 0) / CHARS_PER_FRAME)
    : 0;

const heightOf = (line: TermLine): number => {
  if (line.kind === "banner") {
    return BANNER_H;
  }
  if (line.kind === "prompt") {
    return PROMPT_H;
  }
  if (line.kind === "score") {
    return SCORE_H;
  }
  return LINE_H;
};

interface TermScript {
  duration: number;
  lines: TermLine[];
  scrollSteps: { start: number; delta: number }[];
  starts: number[];
}

// Compile a script: absolute start frames, total duration, and the terminal
// scroll — once the content outgrows the viewport, each new line eases the
// buffer up just far enough to stay visible (monotonic by construction).
const makeScript = (lines: TermLine[], tailHold: number): TermScript => {
  const starts: number[] = [];
  let acc = 14;
  for (const line of lines) {
    acc += line.delay;
    starts.push(acc);
    acc += arrival(line) + (line.pause ?? 0);
  }

  const scrollSteps: { start: number; delta: number }[] = [];
  let target = 0;
  let bottom = 0;
  for (const [i, start] of starts.entries()) {
    bottom += heightOf(lines[i]);
    const next = Math.max(target, bottom - VIEW_H);
    if (next > target) {
      scrollSteps.push({ delta: next - target, start });
      target = next;
    }
  }

  return { duration: acc + tailHold, lines, scrollSteps, starts };
};

const REPORT_SCRIPT = makeScript(REPORT_LINES, 70);
const AGENT_SCRIPT = makeScript(AGENT_LINES, 56);

export const SCAN_REPORT_DURATION = REPORT_SCRIPT.duration;
export const SCAN_AGENT_DURATION = AGENT_SCRIPT.duration;

const SEVERITY_COLOR: Record<Severity, string> = {
  error: ERROR,
  warning: WARNING,
};
const GLYPH: Record<Severity, string> = { error: "✖", warning: "⚠" };

// Braille spinner for the working line, advanced every 3 frames.
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TrafficLight = ({ color }: { readonly color: string }) => (
  <span
    style={{
      background: color,
      borderRadius: 999,
      display: "inline-block",
      height: 11,
      width: 11,
    }}
  />
);

// The Claude Code startup banner — a bordered box, like the real CLI draws.
const ClaudeBanner = () => (
  <div style={{ height: BANNER_H, paddingTop: 8 }}>
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.22)",
        borderRadius: 8,
        display: "inline-block",
        padding: "11px 16px",
      }}
    >
      <div
        style={{
          color: CLAUDE,
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: "20px",
        }}
      >
        {CLAUDE_BANNER.title}
      </div>
      <div style={{ marginTop: 8 }}>
        {CLAUDE_BANNER.rows.map((row) => (
          <div
            key={row.label}
            style={{ fontSize: 13.5, lineHeight: "21px", whiteSpace: "pre" }}
          >
            <span style={{ color: FAINT }}>{row.label}</span>
            <span style={{ color: INK }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// The echoed agent prompt on a subtle panel, wrapping naturally — paragraph
// groups separated by a gap, lines within a group stacked directly.
const ClaudePrompt = () => (
  <div style={{ height: PROMPT_H, paddingTop: 10 }}>
    <div
      style={{
        background: "rgba(0,0,0,0.05)",
        borderRadius: 8,
        height: PROMPT_H - 10,
        overflow: "hidden",
        padding: "14px 16px",
      }}
    >
      <div style={{ paddingLeft: 22, position: "relative" }}>
        <span style={{ color: CLAUDE, left: 0, position: "absolute" }}>›</span>
        {CLAUDE_PROMPT.map((group, groupIndex) => (
          <div
            key={group[0]}
            style={{
              color: groupIndex === 0 ? INK : MUTED,
              fontSize: 13,
              lineHeight: "20px",
              marginTop: groupIndex === 0 ? 0 : 14,
              whiteSpace: "normal",
            }}
          >
            {group.map((text) => (
              <div key={text}>{text}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// The scorecard the real CLI prints: ASCII mascot, score, verdict, meter.
const ScoreBlock = ({
  score,
}: {
  readonly score: NonNullable<TermLine["score"]>;
}) => {
  const color = score.healthy ? GREEN : ERROR;
  const face = score.healthy ? "( ◠ ◠ )>" : "( x x )>";
  const filled = Math.round(score.value / 5);
  const meter = "█".repeat(filled) + "░".repeat(20 - filled);
  return (
    <div style={{ height: SCORE_H, paddingTop: 6 }}>
      <div style={{ display: "flex", gap: 18 }}>
        <div
          style={{
            color,
            fontSize: 14.5,
            fontWeight: 600,
            lineHeight: `${LINE_H}px`,
            whiteSpace: "pre",
          }}
        >
          {" .---.  \n"}
          {face}
          {"\n \\___/  "}
        </div>
        <div style={{ paddingTop: LINE_H - 4 }}>
          <span style={{ color, fontWeight: 700 }}>
            {`${score.value} / 100`}
          </span>
          <span style={{ color: MUTED }}>{`  ·  ${score.verdict}`}</span>
          <div
            style={{
              color: score.healthy ? GREEN : WARNING,
              fontSize: 13,
              letterSpacing: "-0.08em",
            }}
          >
            {meter}
          </div>
        </div>
      </div>
    </div>
  );
};

const LineBody = ({ line }: { readonly line: TermLine }) => {
  switch (line.kind) {
    case "blank": {
      return null;
    }
    case "header": {
      return (
        <>
          <span style={{ color: INK, fontWeight: 600 }}>
            {"  docker-doctor"}
          </span>
          <span style={{ color: FAINT }}>{`  ${line.meta}`}</span>
        </>
      );
    }
    case "summary": {
      return <span style={{ color: MUTED }}>{`  ${line.text}`}</span>;
    }
    case "category": {
      return (
        <span style={{ color: INK, fontWeight: 600 }}>{`  ${line.text}`}</span>
      );
    }
    case "finding": {
      const color = SEVERITY_COLOR[line.severity ?? "error"];
      return (
        <>
          <span style={{ color }}>
            {`  ${GLYPH[line.severity ?? "error"]} ${line.text}`}
          </span>
          <span style={{ color: FAINT }}>{`  [${line.meta}]`}</span>
        </>
      );
    }
    case "code": {
      return (
        <>
          <span style={{ color: MUTED, display: "inline-block", width: 296 }}>
            {`      ${line.text}`}
          </span>
          <span style={{ color: FAINT }}>{line.file}</span>
        </>
      );
    }
    case "fix": {
      return <span style={{ color: ACCENT }}>{`      ${line.text}`}</span>;
    }
    case "hand": {
      return <span style={{ color: INK }}>{`  ${line.text}`}</span>;
    }
    case "banner": {
      return <ClaudeBanner />;
    }
    case "prompt": {
      return <ClaudePrompt />;
    }
    case "ok": {
      return (
        <span style={{ color: GREEN, fontWeight: 600 }}>
          {`  ${line.text}`}
        </span>
      );
    }
    case "score": {
      return line.score ? <ScoreBlock score={line.score} /> : null;
    }
    default: {
      return null;
    }
  }
};

const TerminalCard = ({ script }: { readonly script: TermScript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { lines, scrollSteps, starts } = script;

  const cardOpacity = interpolate(frame, [0, 14], [0, 1], clamp);
  const cardScale = interpolate(frame, [0, 20], [0.985, 1], {
    ...clamp,
    easing: EASE,
  });
  const cardY = interpolate(frame, [0, 20], [18, 0], {
    ...clamp,
    easing: EASE,
  });

  const scroll = scrollSteps.reduce(
    (acc, step) =>
      acc +
      interpolate(frame, [step.start, step.start + 16], [0, step.delta], {
        ...clamp,
        easing: EASE,
      }),
    0
  );

  const cursorOn = Math.floor((frame / fps) * 2) % 2 === 0;
  let activeIndex = -1;
  for (const [i, start] of starts.entries()) {
    if (frame >= start) {
      activeIndex = i;
    }
  }

  const cardStyle = {
    WebkitBackdropFilter: "blur(16px)",
    backdropFilter: "blur(16px)",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid rgba(255,255,255,0.85)",
    borderRadius: 14,
    boxShadow:
      "0 30px 70px rgba(30,40,60,0.24), inset 0 1px 0 rgba(255,255,255,0.8)",
    height: CARD_H,
    opacity: cardOpacity,
    overflow: "hidden",
    transform: `translateY(${cardY}px) scale(${cardScale})`,
    width: CARD_W,
  } as const;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={cardStyle}>
        {/* terminal chrome */}
        <div
          style={{
            alignItems: "center",
            borderBottom: `1px solid ${CHROME_BORDER}`,
            display: "flex",
            gap: 8,
            height: CHROME_H,
            padding: "0 16px",
            position: "relative",
          }}
        >
          <TrafficLight color="#ff5f57" />
          <TrafficLight color="#febc2e" />
          <TrafficLight color="#28c840" />
          <div
            style={{
              color: MUTED,
              fontFamily: MONO,
              fontSize: 13,
              left: 0,
              position: "absolute",
              right: 0,
              textAlign: "center",
            }}
          >
            ~/PunGrumpy
          </div>
        </div>

        {/* scrolling buffer */}
        <div
          style={{
            height: VIEW_H,
            marginTop: PAD_TOP,
            overflow: "hidden",
            padding: `0 ${PAD_X}px`,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 14.5,
              lineHeight: `${LINE_H}px`,
              transform: `translateY(${-scroll}px)`,
            }}
          >
            {lines.map((line, i) => {
              if (frame < starts[i]) {
                return null;
              }
              const local = frame - starts[i];
              const landed = interpolate(local, [0, 4], [0, 1], clamp);

              if (line.kind === "cmd") {
                const revealed = Math.min(
                  line.text?.length ?? 0,
                  Math.floor(local * CHARS_PER_FRAME)
                );
                const typing = revealed < (line.text?.length ?? 0);
                const showCursor = i === activeIndex && typing && cursorOn;
                return (
                  <div
                    key={`${line.kind}-${i}`}
                    style={{
                      alignItems: "center",
                      display: "flex",
                      height: LINE_H,
                      whiteSpace: "pre",
                    }}
                  >
                    <span style={{ color: ACCENT, marginRight: 8 }}>$</span>
                    <span style={{ color: INK }}>
                      {line.text?.slice(0, revealed)}
                    </span>
                    {showCursor ? (
                      <span
                        style={{
                          background: INK,
                          display: "inline-block",
                          height: 15,
                          marginLeft: 2,
                          transform: "translateY(2px)",
                          width: 8,
                        }}
                      />
                    ) : null}
                  </div>
                );
              }

              if (line.kind === "working") {
                // Spins until the completion line lands, then settles to a
                // dim bullet.
                const doneIndex = lines.findIndex(
                  (next, j) => j > i && next.kind === "ok"
                );
                const stopped = doneIndex !== -1 && frame >= starts[doneIndex];
                const glyph = stopped
                  ? "•"
                  : SPINNER[Math.floor(local / 3) % SPINNER.length];
                return (
                  <div
                    key={`${line.kind}-${i}`}
                    style={{
                      height: LINE_H,
                      opacity: landed,
                      whiteSpace: "pre",
                    }}
                  >
                    <span style={{ color: stopped ? FAINT : CLAUDE }}>
                      {`  ${glyph} `}
                    </span>
                    <span style={{ color: stopped ? MUTED : INK }}>
                      {line.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={`${line.kind}-${i}`}
                  style={{
                    height: heightOf(line),
                    opacity: landed,
                    whiteSpace: "pre",
                  }}
                >
                  <LineBody line={line} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ScanReport = () => <TerminalCard script={REPORT_SCRIPT} />;
export const ScanAgent = () => <TerminalCard script={AGENT_SCRIPT} />;
