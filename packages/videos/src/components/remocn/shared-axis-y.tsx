import { Easing, interpolate, useCurrentFrame } from "remotion";

// Ported from blume's remocn SharedAxisY: a hard, word-level cut between two
// lines — outgoing words step OFF, incoming words step ON, both with a
// 2-frame word stagger and step easing. Terminal-crisp, no glides.

const ENTER_DUR = 5;
const EXIT_DUR = 4;
const ENTER_STAGGER = 2;
const EXIT_STAGGER = 2;
const MICRO_DELAY = 1;

const FONT =
  "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif";

const Line = ({
  words,
  fontSize,
  color,
  fontWeight,
  opacityFor,
}: {
  readonly words: readonly string[];
  readonly fontSize: number;
  readonly color: string;
  readonly fontWeight: number;
  readonly opacityFor: (index: number) => number;
}) => (
  <div
    style={{
      alignItems: "center",
      display: "flex",
      inset: 0,
      justifyContent: "center",
      position: "absolute",
    }}
  >
    <span
      style={{
        color,
        fontFamily: FONT,
        fontSize,
        fontWeight,
        letterSpacing: "-0.03em",
      }}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          style={{
            display: "inline-block",
            marginRight: "0.25em",
            opacity: opacityFor(i),
          }}
        >
          {word}
        </span>
      ))}
    </span>
  </div>
);

export const SharedAxisY = ({
  fromText,
  toText,
  fontSize = 72,
  color = "#ffffff",
  fontWeight = 600,
}: {
  readonly fromText: string;
  readonly toText: string;
  readonly fontSize?: number;
  readonly color?: string;
  readonly fontWeight?: number;
}) => {
  const frame = useCurrentFrame();
  const fromWords = fromText.split(" ");
  const toWords = toText.split(" ");

  const exitTotal = EXIT_DUR + (fromWords.length - 1) * EXIT_STAGGER;
  const newStart = Math.max(0, exitTotal + MICRO_DELAY);
  const step = {
    easing: Easing.step1,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  return (
    <div style={{ inset: 0, position: "absolute" }}>
      <Line
        color={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        opacityFor={(i) =>
          interpolate(frame - i * EXIT_STAGGER, [0, EXIT_DUR], [1, 0], step)
        }
        words={fromWords}
      />
      <Line
        color={color}
        fontSize={fontSize}
        fontWeight={fontWeight}
        opacityFor={(j) =>
          interpolate(
            frame - newStart - j * ENTER_STAGGER,
            [0, ENTER_DUR],
            [0, 1],
            step
          )
        }
        words={toWords}
      />
    </div>
  );
};
