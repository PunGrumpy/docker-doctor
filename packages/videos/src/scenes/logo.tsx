import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { Mark } from "../components/mark";

// The sign-off lockup: the site's brand mark over the Instrument Serif
// wordmark — the same mark-plus-wordmark close blume ends on.

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

// `urlSize` exists because the lockup is authored once and used on two
// stages: the 16:9 cut scales it 1.5x on the way to 1920, the square cut
// renders it 1:1, so the URL needs sizing up there to stay readable.
export const Logo = ({ urlSize = 17 }: { readonly urlSize?: number }) => {
  const frame = useCurrentFrame();
  const clamp = {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const rise = (delay: number) => ({
    opacity: interpolate(frame - delay, [0, 18], [0, 1], clamp),
    transform: `translateY(${interpolate(frame - delay, [0, 18], [14, 0], clamp)}px)`,
  });

  return (
    <AbsoluteFill
      style={{ alignItems: "center", gap: 30, justifyContent: "center" }}
    >
      <div style={rise(0)}>
        <Mark size={76} />
      </div>
      <div
        style={{
          color: "rgba(0,0,0,0.85)",
          fontFamily: "var(--font-serif), ui-serif, Georgia, serif",
          fontSize: 92,
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          ...rise(6),
        }}
      >
        Docker Doctor
      </div>
      <div
        style={{
          color: "rgba(0,0,0,0.55)",
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
          fontSize: urlSize,
          ...rise(14),
        }}
      >
        docker-doctor.vercel.app
      </div>
    </AbsoluteFill>
  );
};
