import type { BaseLine } from "../components/terminal-card";
import {
  CLAUDE,
  ERROR,
  GREEN,
  INK,
  makeScript,
  MUTED,
  TerminalCard,
  viewportHeight,
  WARNING,
} from "../components/terminal-card";

// The Docker Sandboxes kit scene: one continuous terminal, because that is
// what actually happens — `sbx run` boots the microVM and drops you into the
// agent in the same window. The buffer scrolls rather than cutting to a second
// card, so the run reads as one session.
//
// Sized for a phone-width feed player: 26px on the 1080 stage (~2.4% of frame
// width) against the launch video's 14.5px, which caps every line at 56
// characters — the copy below is written to that budget.

const FONT_SIZE = 26;
const LINE = 40;
const ASK_H = 80;
const CARD_W = 940;
const CARD_H = 830;

type Tone = "good" | "warn";
type Severity = "error" | "warning";

interface SandboxLine extends BaseLine {
  kind: "cmd" | "blank" | "ok" | "working" | "finding" | "key" | "ask" | "note";
  /** ok lines: green when the step succeeded, amber when it found something. */
  tone?: Tone;
  severity?: Severity;
}

// Every line mirrors something the kit actually does: the pinned npm install,
// the global skill install across the eight supported agents, and the injected
// agent instruction — see kits/docker-doctor/spec.yaml. The two findings are
// real rule keys, and the score matches what the CLI prints once they are
// fixed.
const RUN_LINES: SandboxLine[] = [
  { delay: 14, kind: "cmd", text: "sbx run --kit \\" },
  {
    delay: 2,
    kind: "cmd",
    prefix: " ",
    text: "docker.io/pungrumpy/docker-doctor-kit:latest claude",
  },
  { delay: 10, kind: "blank" },
  {
    delay: 6,
    kind: "ok",
    text: "microVM started — private Docker daemon",
    tone: "good",
  },
  {
    delay: 8,
    kind: "ok",
    text: "@docker-doctor/cli installed (pinned)",
    tone: "good",
  },
  {
    delay: 8,
    kind: "ok",
    text: "/docker-doctor skill installed for 8 agents",
    tone: "good",
  },
  {
    delay: 8,
    kind: "ok",
    pause: 8,
    text: "agent memory: lint before committing",
    tone: "good",
  },
  { delay: 8, kind: "blank" },
  {
    delay: 4,
    kind: "note",
    pause: 14,
    text: "✻ Claude Code · sandbox:~/workspace",
  },
  { delay: 8, kind: "ask", pause: 12, text: "Containerize this service." },
  { delay: 6, kind: "blank" },
  { delay: 0, kind: "working", pause: 20, text: "Writing Dockerfile…" },
  { delay: 6, kind: "ok", text: "Dockerfile written", tone: "good" },
  { delay: 8, kind: "blank" },
  // Nobody asked for this step — the agent memory did.
  { delay: 0, kind: "working", pause: 22, text: "Running docker-doctor…" },
  { delay: 6, kind: "ok", text: "2 issues found", tone: "warn" },
  {
    delay: 6,
    kind: "finding",
    severity: "error",
    text: "Base image uses a mutable tag",
  },
  { delay: 2, kind: "key", text: "pin-image-version" },
  {
    delay: 4,
    kind: "finding",
    severity: "warning",
    text: "Container runs as root",
  },
  { delay: 2, kind: "key", pause: 8, text: "no-root-user" },
  { delay: 8, kind: "blank" },
  { delay: 0, kind: "working", pause: 20, text: "Applying both fixes…" },
  { delay: 6, kind: "ok", text: "Dockerfile updated", tone: "good" },
  { delay: 8, kind: "working", pause: 18, text: "Re-scanning…" },
  {
    delay: 6,
    kind: "ok",
    pause: 8,
    text: "No issues found · 100 / 100",
    tone: "good",
  },
  { delay: 8, kind: "blank" },
  {
    delay: 4,
    kind: "ok",
    pause: 22,
    text: "Committed — 1 file changed",
    tone: "good",
  },
];

const heightOf = (line: SandboxLine): number =>
  line.kind === "ask" ? ASK_H : LINE;

const RUN_SCRIPT = makeScript(RUN_LINES, {
  heightOf,
  tailHold: 20,
  viewHeight: viewportHeight(CARD_H),
});

export const SANDBOX_RUN_DURATION = RUN_SCRIPT.duration;

const SEVERITY_COLOR: Record<Severity, string> = {
  error: ERROR,
  warning: WARNING,
};
const GLYPH: Record<Severity, string> = { error: "✖", warning: "⚠" };

// The instruction the human actually gave — the only thing in the whole run
// that a person typed.
const Ask = ({ text }: { readonly text: string }) => (
  <div style={{ height: ASK_H, paddingTop: 10 }}>
    <div
      style={{
        background: "rgba(0,0,0,0.05)",
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      <span style={{ color: CLAUDE, marginRight: 12 }}>›</span>
      <span style={{ color: INK }}>{text}</span>
    </div>
  </div>
);

const LineBody = (line: SandboxLine) => {
  switch (line.kind) {
    case "blank": {
      return null;
    }
    case "ask": {
      return <Ask text={line.text ?? ""} />;
    }
    case "note": {
      return (
        <>
          <span style={{ color: CLAUDE }}>{"  ✻ "}</span>
          <span style={{ color: INK }}>{line.text?.replace("✻ ", "")}</span>
        </>
      );
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
          {`      ${GLYPH[severity]} ${line.text}`}
        </span>
      );
    }
    case "key": {
      return <span style={{ color: MUTED }}>{`        ${line.text}`}</span>;
    }
    default: {
      return <span style={{ color: MUTED }}>{`  ${line.text}`}</span>;
    }
  }
};

export const SandboxRun = () => (
  <TerminalCard
    fontSize={FONT_SIZE}
    height={CARD_H}
    heightOf={heightOf}
    lineHeight={LINE}
    renderLine={LineBody}
    script={RUN_SCRIPT}
    title="~/PunGrumpy"
    width={CARD_W}
  />
);
