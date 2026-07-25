import { Easing, interpolate, useCurrentFrame } from "remotion";

// Ported from blume's remocn SoftBlurIn: every character rises, sharpens and
// fades in with a 1-frame stagger, so a line materializes left-to-right.

const CHAR_DURATION = 27;
const STAGGER = 1;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export const SoftBlurIn = ({
  text,
  blur = 12,
  fontSize = 72,
  color = "#ffffff",
  fontWeight = 600,
  fontFamily = "var(--font-geist-sans), -apple-system, sans-serif",
  letterSpacing = "-0.05em",
}: {
  readonly text: string;
  readonly blur?: number;
  readonly fontSize?: number;
  readonly color?: string;
  readonly fontWeight?: number;
  readonly fontFamily?: string;
  readonly letterSpacing?: string;
}) => {
  const frame = useCurrentFrame();
  const chars = [...text];
  const clamp = {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

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
      <span style={{ color, fontFamily, fontSize, fontWeight, letterSpacing }}>
        {chars.map((char, i) => {
          const local = frame - i * STAGGER;
          const opacity = interpolate(local, [0, CHAR_DURATION], [0, 1], clamp);
          const y = interpolate(local, [0, CHAR_DURATION], [16, 0], clamp);
          const blurAmount = interpolate(
            local,
            [0, CHAR_DURATION],
            [blur, 0],
            clamp
          );
          return (
            <span
              key={`${char}-${i}`}
              style={{
                backfaceVisibility: "hidden",
                display: "inline-block",
                filter: `blur(${blurAmount}px)`,
                opacity,
                transform: `translateY(${y}px)`,
                whiteSpace: "pre",
              }}
            >
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
};
