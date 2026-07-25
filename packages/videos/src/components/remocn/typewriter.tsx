import { useCurrentFrame, useVideoConfig } from "remotion";

// Ported from blume's remocn Typewriter: characters land at a fixed
// chars-per-second rate; the caret is solid while typing and blinks at 2 Hz
// once the line is complete, running out to the end of the sequence.

export const Typewriter = ({
  text,
  fontSize = 64,
  charsPerSecond = 16,
  color = "#ffffff",
  cursorColor = "#ffffff",
  fontWeight = 600,
  fontFamily = "var(--font-geist-sans), -apple-system, sans-serif",
}: {
  readonly text: string;
  readonly fontSize?: number;
  readonly charsPerSecond?: number;
  readonly color?: string;
  readonly cursorColor?: string;
  readonly fontWeight?: number;
  readonly fontFamily?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealed = Math.min(
    text.length,
    Math.floor((frame / fps) * charsPerSecond)
  );
  const typing = revealed < text.length;
  const caretOn = typing || Math.floor((frame / fps) * 2) % 2 === 0;

  return (
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
          fontFamily,
          fontSize,
          fontWeight,
          letterSpacing: "-0.03em",
          whiteSpace: "pre",
        }}
      >
        {text.slice(0, revealed)}
        <span
          style={{
            backgroundColor: cursorColor,
            display: "inline-block",
            height: "1em",
            marginLeft: "0.04em",
            opacity: caretOn ? 1 : 0,
            verticalAlign: "text-bottom",
            width: "0.08em",
          }}
        />
      </span>
    </div>
  );
};
