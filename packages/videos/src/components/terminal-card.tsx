import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// The frosted terminal card every scan/sandbox scene draws into — chrome,
// the scrolling buffer, command typing, and the working spinner. Scenes bring
// their own line vocabulary through `renderLine`; everything a terminal does
// regardless of what it prints lives here.

export const MONO =
  "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace";

export const INK = "rgba(0,0,0,0.85)";
export const MUTED = "rgba(0,0,0,0.55)";
export const FAINT = "rgba(0,0,0,0.34)";
export const ACCENT = "#2563eb";
export const ERROR = "#c93a3a";
export const WARNING = "#b45309";
export const GREEN = "#15803d";
// Kept at the brand terracotta: it only ever carries glyphs and marks that
// sit beside text in INK, never information on its own.
export const CLAUDE = "#cd694a";

const CHROME_BORDER = "rgba(90,100,120,0.14)";
const CHROME_H = 40;
const PAD_X = 26;
const PAD_TOP = 12;
const PAD_BOTTOM = 18;

export const LINE_H = 23;
const FONT_SIZE = 14.5;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const CHARS_PER_FRAME = 2;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Braille spinner for the working line, advanced every 3 frames.
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface BaseLine {
  /** `cmd` types out and `working` spins; every other kind is the scene's. */
  kind: string;
  text?: string;
  /** cmd lines: the gutter mark. Defaults to `$`; pass " " to continue the
      previous command onto another line. */
  prefix?: string;
  /** Frames after the previous line finishes before this one lands. */
  delay: number;
  /** Extra hold after this line, before the next starts. */
  pause?: number;
}

export interface TermScript<L extends BaseLine> {
  duration: number;
  lines: L[];
  scrollSteps: { start: number; delta: number }[];
  starts: number[];
}

/** Frames a line spends arriving: cmd lines type, output lines just land. */
const arrival = (line: BaseLine): number =>
  line.kind === "cmd"
    ? Math.ceil((line.text?.length ?? 0) / CHARS_PER_FRAME)
    : 0;

/** Buffer height for a card — what the scroll math has to fit content into. */
export const viewportHeight = (cardHeight: number): number =>
  cardHeight - CHROME_H - PAD_TOP - PAD_BOTTOM;

// Compile a script: absolute start frames, total duration, and the terminal
// scroll — once the content outgrows the viewport, each new line eases the
// buffer up just far enough to stay visible (monotonic by construction).
export const makeScript = <L extends BaseLine>(
  lines: L[],
  {
    heightOf,
    tailHold,
    viewHeight,
  }: {
    heightOf: (line: L) => number;
    tailHold: number;
    viewHeight: number;
  }
): TermScript<L> => {
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
    const next = Math.max(target, bottom - viewHeight);
    if (next > target) {
      scrollSteps.push({ delta: next - target, start });
      target = next;
    }
  }

  return { duration: acc + tailHold, lines, scrollSteps, starts };
};

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

interface TerminalCardProps<L extends BaseLine> {
  readonly script: TermScript<L>;
  /** Everything past `cmd`/`working` — the scene's own line vocabulary. */
  readonly renderLine: (line: L) => ReactNode;
  readonly heightOf: (line: L) => number;
  readonly width: number;
  readonly height: number;
  /** The path shown centered in the chrome. */
  readonly title: string;
  /** Buffer type scale. Defaults suit the 16:9 stage; the square cut sizes
      up so the text survives a phone-sized feed player. */
  readonly fontSize?: number;
  readonly lineHeight?: number;
}

export const TerminalCard = <L extends BaseLine>({
  script,
  renderLine,
  heightOf,
  width,
  height,
  title,
  fontSize = FONT_SIZE,
  lineHeight = LINE_H,
}: TerminalCardProps<L>) => {
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
    height,
    opacity: cardOpacity,
    overflow: "hidden",
    transform: `translateY(${cardY}px) scale(${cardScale})`,
    width,
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
              fontSize: Math.round(fontSize * 0.9),
              left: 0,
              position: "absolute",
              right: 0,
              textAlign: "center",
            }}
          >
            {title}
          </div>
        </div>

        {/* scrolling buffer */}
        <div
          style={{
            height: viewportHeight(height),
            marginTop: PAD_TOP,
            overflow: "hidden",
            padding: `0 ${PAD_X}px`,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize,
              lineHeight: `${lineHeight}px`,
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
                      height: lineHeight,
                      whiteSpace: "pre",
                    }}
                  >
                    <span style={{ color: ACCENT, marginRight: 8 }}>
                      {line.prefix ?? "$"}
                    </span>
                    <span style={{ color: INK }}>
                      {line.text?.slice(0, revealed)}
                    </span>
                    {showCursor ? (
                      <span
                        style={{
                          background: INK,
                          display: "inline-block",
                          height: Math.round(fontSize),
                          marginLeft: 2,
                          transform: "translateY(2px)",
                          width: Math.round(fontSize * 0.55),
                        }}
                      />
                    ) : null}
                  </div>
                );
              }

              if (line.kind === "working") {
                // Spins until the next `ok` line lands, then settles to a dim
                // bullet — the beat where the agent is actually working.
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
                      height: lineHeight,
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
                  {renderLine(line)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
