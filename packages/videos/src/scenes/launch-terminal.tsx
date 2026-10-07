import type { BaseLine } from "../components/terminal-card";
import {
  ERROR,
  GREEN,
  INK,
  makeScript,
  MUTED,
  TerminalCard,
  viewportHeight,
  WARNING,
} from "../components/terminal-card";

// The social launch scene: one continuous terminal that runs the whole loop —
// scan, findings, hand off to the agent, re-scan — because the loop is the
// pitch and a cut between two cards would hide that it is one session.
//
// Sized like the sandbox scene: 26px on the 1080 stage, which caps every line
// at 56 characters — the copy below is written to that budget.

const FONT_SIZE = 26;
const LINE = 40;
// Two buffer lines exactly, so the scroll never rests on a half-cut row.
const SCORE_H = 80;
const CARD_W = 940;
const CARD_H = 830;

const SCAN_COMMAND = "npx @docker-doctor/cli@latest";

type Tone = "good" | "warn";
type Severity = "error" | "warning";

interface LaunchLine extends BaseLine {
  kind:
    | "cmd"
    | "blank"
    | "ok"
    | "working"
    | "finding"
    | "key"
    | "more"
    | "hand"
    | "score";
  /** ok lines: green when the step succeeded, amber when it found something. */
  tone?: Tone;
  severity?: Severity;
  /** score rows: the number, verdict, and meter fill. */
  score?: { value: number; verdict: string; healthy: boolean };
}

// Every number here is what @docker-doctor/cli 0.7.0 prints for a five-line
// Dockerfile (`FROM node:latest`, `COPY . .`, `RUN npm install`) next to a
// Compose file that mounts the Docker socket: 11 issues, 75 / 100 Good, and
// 100 / 100 Excellent once they are fixed. The four findings shown are real
// rule keys at the lines the CLI reports them on.
const RUN_LINES: LaunchLine[] = [
  { delay: 14, kind: "cmd", text: SCAN_COMMAND },
  { delay: 8, kind: "blank" },
  {
    delay: 4,
    kind: "ok",
    text: "11 issues · 2 files · 33 rules",
    tone: "warn",
  },
  { delay: 4, kind: "blank" },
  {
    delay: 5,
    kind: "finding",
    severity: "error",
    text: "Docker socket mounted into a service",
  },
  { delay: 2, kind: "key", text: "no-docker-socket-mount · compose.yaml:7" },
  {
    delay: 5,
    kind: "finding",
    severity: "warning",
    text: "Container runs as root",
  },
  { delay: 2, kind: "key", text: "no-root-user · Dockerfile:1" },
  {
    delay: 5,
    kind: "finding",
    severity: "warning",
    text: "Base image uses the mutable 'latest' tag",
  },
  { delay: 2, kind: "key", text: "pin-image-version · Dockerfile:1" },
  {
    delay: 5,
    kind: "finding",
    severity: "warning",
    text: "COPY . . before npm install",
  },
  { delay: 2, kind: "key", text: "order-layers · Dockerfile:4" },
  { delay: 4, kind: "more", text: "+ 7 more" },
  { delay: 4, kind: "blank" },
  {
    delay: 6,
    kind: "score",
    pause: 34,
    score: { healthy: false, value: 75, verdict: "Good" },
  },
  { delay: 6, kind: "blank" },
  { delay: 4, kind: "hand", pause: 8, text: "Handing 11 findings to Claude…" },
  // The spinner runs through the pause — the beat where the agent works —
  // and settles when the completion line lands.
  { delay: 0, kind: "working", pause: 44, text: "Fixing 11 issues…" },
  { delay: 6, kind: "ok", text: "11 issues fixed", tone: "good" },
  { delay: 6, kind: "blank" },
  { delay: 4, kind: "cmd", text: SCAN_COMMAND },
  { delay: 8, kind: "ok", text: "No issues found", tone: "good" },
  {
    delay: 6,
    kind: "score",
    score: { healthy: true, value: 100, verdict: "Excellent" },
  },
];

const heightOf = (line: LaunchLine): number =>
  line.kind === "score" ? SCORE_H : LINE;

const RUN_SCRIPT = makeScript(RUN_LINES, {
  heightOf,
  tailHold: 44,
  viewHeight: viewportHeight(CARD_H),
});

export const LAUNCH_RUN_DURATION = RUN_SCRIPT.duration;

const SEVERITY_COLOR: Record<Severity, string> = {
  error: ERROR,
  warning: WARNING,
};
const GLYPH: Record<Severity, string> = { error: "✖", warning: "⚠" };

const METER_CELLS = 40;
// Two monospace columns at the buffer size — the indent every line shares.
const INDENT = 31;

// The score the CLI closes on, with its meter — the one number the whole
// video exists to move.
const ScoreBlock = ({
  score,
}: {
  readonly score: NonNullable<LaunchLine["score"]>;
}) => {
  const color = score.healthy ? GREEN : WARNING;
  const filled = Math.round((score.value / 100) * METER_CELLS);
  const meter = "█".repeat(filled) + "░".repeat(METER_CELLS - filled);
  return (
    <div style={{ height: SCORE_H, paddingTop: 4 }}>
      <div style={{ lineHeight: `${LINE}px` }}>
        <span style={{ color, fontWeight: 700 }}>
          {`  ${score.value} / 100`}
        </span>
        <span style={{ color: MUTED }}>{`  ·  ${score.verdict}`}</span>
      </div>
      <div
        style={{
          color,
          fontSize: 22,
          letterSpacing: "-0.08em",
          lineHeight: "36px",
          paddingLeft: INDENT,
        }}
      >
        {meter}
      </div>
    </div>
  );
};

const LineBody = (line: LaunchLine) => {
  switch (line.kind) {
    case "blank": {
      return null;
    }
    case "ok": {
      const color = line.tone === "warn" ? WARNING : GREEN;
      const glyph = line.tone === "warn" ? "!" : "✔";
      return (
        <span style={{ color, fontWeight: 600 }}>
          {`  ${glyph} ${line.text}`}
        </span>
      );
    }
    case "finding": {
      const severity = line.severity ?? "error";
      return (
        <span style={{ color: SEVERITY_COLOR[severity] }}>
          {`  ${GLYPH[severity]} ${line.text}`}
        </span>
      );
    }
    case "key": {
      return <span style={{ color: MUTED }}>{`    ${line.text}`}</span>;
    }
    case "hand": {
      return <span style={{ color: INK }}>{`  ${line.text}`}</span>;
    }
    case "score": {
      return line.score ? <ScoreBlock score={line.score} /> : null;
    }
    default: {
      return <span style={{ color: MUTED }}>{`  ${line.text}`}</span>;
    }
  }
};

export const LaunchRun = () => (
  <TerminalCard
    fontSize={FONT_SIZE}
    height={CARD_H}
    heightOf={heightOf}
    lineHeight={LINE}
    renderLine={LineBody}
    script={RUN_SCRIPT}
    title="~/app"
    width={CARD_W}
  />
);
