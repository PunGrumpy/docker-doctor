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

// The Docker Sandboxes kit scenes, on the same frosted card as the scan
// terminals but authored for the square stage:
//   SandboxBoot — `sbx run --kit …` brings a microVM up with the CLI, the
//   skill, and the agent memory already in place.
//   SandboxAgent — the payoff: the agent writes a Dockerfile, scans it, fixes
//   what it finds, and commits, all on its own.

// Sized for a phone-width feed player: the buffer runs at 21px on the 1080
// stage (~2% of frame width) instead of the launch video's 14.5px, and the
// card is only as tall as its scene's script needs.
const FONT_SIZE = 21;
const LINE = 33;
const ASK_H = 66;
const CARD_W = 920;
const BOOT_H = 420;
const AGENT_H = 664;

type Tone = "good" | "warn";
type Severity = "error" | "warning";

interface SandboxLine extends BaseLine {
  kind: "cmd" | "blank" | "ok" | "working" | "finding" | "ask" | "note";
  /** ok lines: green when the step succeeded, amber when it found something. */
  tone?: Tone;
  severity?: Severity;
  /** finding lines: the dim rule key. */
  meta?: string;
}

// Every line mirrors something the kit actually does: the pinned npm install,
// the global skill install across the eight supported agents, and the injected
// agent instruction — see kits/docker-doctor/spec.yaml.
const BOOT_LINES: SandboxLine[] = [
  {
    delay: 14,
    kind: "cmd",
    text: "sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude",
  },
  { delay: 10, kind: "blank" },
  {
    delay: 6,
    kind: "ok",
    text: "microVM started — own kernel, private Docker daemon",
    tone: "good",
  },
  {
    delay: 8,
    kind: "ok",
    text: "@docker-doctor/cli installed — pinned, verified from npm",
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
    pause: 10,
    text: "agent memory: lint Docker changes before committing",
    tone: "good",
  },
  { delay: 8, kind: "blank" },
  {
    delay: 4,
    kind: "note",
    pause: 26,
    text: "✻ Claude Code · ~/workspace",
  },
];

// The loop the kit exists to produce. The two findings are real rule keys,
// and the score matches what the CLI prints once they are fixed.
const AGENT_LINES: SandboxLine[] = [
  { delay: 2, kind: "ask", pause: 16, text: "Containerize this service." },
  { delay: 6, kind: "blank" },
  { delay: 0, kind: "working", pause: 30, text: "Writing Dockerfile…" },
  { delay: 6, kind: "ok", text: "Dockerfile written", tone: "good" },
  { delay: 8, kind: "blank" },
  // Nobody asked for this step — the agent memory did.
  { delay: 0, kind: "working", pause: 32, text: "Running docker-doctor…" },
  { delay: 6, kind: "ok", text: "2 issues found", tone: "warn" },
  {
    delay: 6,
    kind: "finding",
    meta: "pin-image-version",
    severity: "error",
    text: "Base image uses the mutable 'latest' tag",
  },
  {
    delay: 4,
    kind: "finding",
    meta: "no-root-user",
    pause: 10,
    severity: "warning",
    text: "Container runs as root",
  },
  { delay: 6, kind: "blank" },
  { delay: 0, kind: "working", pause: 32, text: "Applying both fixes…" },
  { delay: 6, kind: "ok", text: "Dockerfile updated", tone: "good" },
  { delay: 8, kind: "blank" },
  { delay: 0, kind: "working", pause: 26, text: "Re-scanning…" },
  {
    delay: 6,
    kind: "ok",
    pause: 10,
    text: "No issues found · 100 / 100",
    tone: "good",
  },
  { delay: 10, kind: "blank" },
  {
    delay: 4,
    kind: "ok",
    pause: 34,
    text: "Committed — 1 file changed",
    tone: "good",
  },
];

const heightOf = (line: SandboxLine): number =>
  line.kind === "ask" ? ASK_H : LINE;

const BOOT_SCRIPT = makeScript(BOOT_LINES, {
  heightOf,
  tailHold: 20,
  viewHeight: viewportHeight(BOOT_H),
});
const AGENT_SCRIPT = makeScript(AGENT_LINES, {
  heightOf,
  tailHold: 30,
  viewHeight: viewportHeight(AGENT_H),
});

export const SANDBOX_BOOT_DURATION = BOOT_SCRIPT.duration;
export const SANDBOX_AGENT_DURATION = AGENT_SCRIPT.duration;

const SEVERITY_COLOR: Record<Severity, string> = {
  error: ERROR,
  warning: WARNING,
};
const GLYPH: Record<Severity, string> = { error: "✖", warning: "⚠" };

// The instruction the human actually gave — the only thing in the whole run
// that a person typed.
const Ask = ({ text }: { readonly text: string }) => (
  <div style={{ height: ASK_H, paddingTop: 8 }}>
    <div
      style={{
        background: "rgba(0,0,0,0.05)",
        borderRadius: 8,
        padding: "12px 16px",
      }}
    >
      <span style={{ color: CLAUDE, marginRight: 10 }}>›</span>
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
      return <span style={{ color: CLAUDE }}>{`  ${line.text}`}</span>;
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
      const color = SEVERITY_COLOR[line.severity ?? "error"];
      return (
        <>
          <span style={{ color }}>
            {`      ${GLYPH[line.severity ?? "error"]} ${line.text}`}
          </span>
          <span style={{ color: MUTED }}>{`  [${line.meta}]`}</span>
        </>
      );
    }
    default: {
      return <span style={{ color: MUTED }}>{`  ${line.text}`}</span>;
    }
  }
};

export const SandboxBoot = () => (
  <TerminalCard
    fontSize={FONT_SIZE}
    height={BOOT_H}
    heightOf={heightOf}
    lineHeight={LINE}
    renderLine={LineBody}
    script={BOOT_SCRIPT}
    title="~/PunGrumpy"
    width={CARD_W}
  />
);

export const SandboxAgent = () => (
  <TerminalCard
    fontSize={FONT_SIZE}
    height={AGENT_H}
    heightOf={heightOf}
    lineHeight={LINE}
    renderLine={LineBody}
    script={AGENT_SCRIPT}
    title="sandbox · ~/workspace"
    width={CARD_W}
  />
);
