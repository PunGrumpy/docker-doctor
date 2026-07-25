import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { Backdrop } from "./components/backdrop";
import { SharedAxisY } from "./components/remocn/shared-axis-y";
import { SoftBlurIn } from "./components/remocn/soft-blur-in";
import { Typewriter } from "./components/remocn/typewriter";
import { mono, sans, serif } from "./fonts";
import { Logo } from "./scenes/logo";
import {
  SCAN_AGENT_DURATION,
  SCAN_REPORT_DURATION,
  ScanAgent,
  ScanReport,
} from "./scenes/scan-terminal";

// The Docker Doctor launch video, built on blume's launch-video system:
// gradient backdrop, white Geist type, frosted terminal cards, and a
// derived timeline so the terminal scenes can grow without hand-retiming
// everything after them.

const WHITE = "#ffffff";
const SANS =
  "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif";

// Nudge a full-frame, self-centering component off-center without touching
// its internals: translate the frame it lays itself out in.
const Positioned = ({
  dy = 0,
  children,
}: {
  readonly dy?: number;
  readonly children: ReactNode;
}) => (
  <div
    style={{ inset: 0, position: "absolute", transform: `translateY(${dy}px)` }}
  >
    {children}
  </div>
);

// A hard, non-animated line — the punchy first snap of the feature run.
const CenteredLine = ({
  text,
  fontSize = 64,
}: {
  readonly text: string;
  readonly fontSize?: number;
}) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
    <span
      style={{
        color: WHITE,
        fontFamily: SANS,
        fontSize,
        fontWeight: 600,
        letterSpacing: "-0.03em",
      }}
    >
      {text}
    </span>
  </AbsoluteFill>
);

// ─── Scene 1 · The setup ────────────────────────────────────────────────────
// Two centered lines blur in — the second trails the first by 0.25s (8f
// @30fps) so the question lands as a beat, not a single flash.
const SceneTagline = () => (
  <>
    <Positioned dy={-37}>
      <SoftBlurIn color={WHITE} fontSize={70} text="Your containers run." />
    </Positioned>
    <Sequence from={8} layout="none">
      <Positioned dy={37}>
        <SoftBlurIn color={WHITE} fontSize={70} text="But are they healthy?" />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 3 · The question ─────────────────────────────────────────────────
// The pivot between the two terminals, in the tagline's two-line rhythm.
const QUESTION_DURATION = 80;

const SceneQuestion = () => (
  <>
    <Positioned dy={-37}>
      <SoftBlurIn color={WHITE} fontSize={62} text="But who wants to fix" />
    </Positioned>
    <Sequence from={8} layout="none">
      <Positioned dy={37}>
        <SoftBlurIn color={WHITE} fontSize={62} text="all that by hand?" />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 5 · The feature run ──────────────────────────────────────────────
const SNAPS = [
  "30 rules. Zero setup.",
  "Root users. Mutable tags.",
  "Layer order. Image size.",
  "Dockerfile and Compose.",
  "Fails CI before production.",
];

const FEATURES_DURATION = 40 * (SNAPS.length - 1) + 70;

const SceneFeatures = () => (
  <>
    {/* First claim lands hard, then each swap walks down the list. The final
        swap holds longer (one 40f beat per snap) so the last claim rests on
        screen before the cut. */}
    <Sequence durationInFrames={40} layout="none">
      <CenteredLine text={SNAPS[0]} />
    </Sequence>
    {SNAPS.slice(1).map((snap, i) => {
      const isLast = i === SNAPS.length - 2;
      return (
        <Sequence
          durationInFrames={isLast ? 70 : 40}
          from={40 + i * 40}
          key={snap}
          layout="none"
        >
          <SharedAxisY
            color={WHITE}
            fontSize={64}
            fromText={SNAPS[i]}
            toText={snap}
          />
        </Sequence>
      );
    })}
  </>
);

// ─── Scene 6 · The close ────────────────────────────────────────────────────
const SceneCta = () => (
  // Transparent so the backdrop carries through, with the caret running out
  // to the final frame.
  <Sequence durationInFrames={90} layout="none">
    <Typewriter
      background="transparent"
      charsPerSecond={16}
      color={WHITE}
      cursorColor={WHITE}
      fontSize={64}
      text="bunx @docker-doctor/cli"
    />
  </Sequence>
);

// Wire the loaded faces to the CSS variables every component reads.
const FONT_VARS = {
  "--font-geist-mono": mono.fontFamily,
  "--font-geist-sans": sans.fontFamily,
  "--font-serif": serif.fontFamily,
} as CSSProperties;

// Every scene is authored against this reference stage; the whole tree is
// scaled uniformly to whatever 16:9 resolution the composition is set to
// (720p → 1080p is an exact 1.5×), so nothing re-lays-out per resolution.
const REF_W = 1280;
const REF_H = 720;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene starts, derived so the terminal scenes can grow without hand-retiming
// everything after them.
const TAGLINE_END = 90;
const REPORT_END = TAGLINE_END + SCAN_REPORT_DURATION;
const QUESTION_END = REPORT_END + QUESTION_DURATION;
const AGENT_END = QUESTION_END + SCAN_AGENT_DURATION;
const FEATURES_END = AGENT_END + FEATURES_DURATION;
const CTA_END = FEATURES_END + 90;
export const DURATION = CTA_END + 90;

export const DockerDoctor = () => {
  const { width } = useVideoConfig();
  const stageScale = width / REF_W;

  return (
    <AbsoluteFill style={FONT_VARS}>
      <Backdrop />

      {/* Reference stage, scaled from the top-left to fill the frame. */}
      <AbsoluteFill>
        <div
          style={{
            height: REF_H,
            position: "relative",
            transform: `scale(${stageScale})`,
            transformOrigin: "top left",
            width: REF_W,
          }}
        >
          <Sequence durationInFrames={TAGLINE_END} layout="none">
            <SceneTagline />
          </Sequence>
          <Sequence
            durationInFrames={SCAN_REPORT_DURATION}
            from={TAGLINE_END}
            layout="none"
          >
            <ScanReport />
          </Sequence>
          <Sequence
            durationInFrames={QUESTION_DURATION}
            from={REPORT_END}
            layout="none"
          >
            <SceneQuestion />
          </Sequence>
          <Sequence
            durationInFrames={SCAN_AGENT_DURATION}
            from={QUESTION_END}
            layout="none"
          >
            <ScanAgent />
          </Sequence>
          <Sequence
            durationInFrames={FEATURES_DURATION}
            from={AGENT_END}
            layout="none"
          >
            <SceneFeatures />
          </Sequence>
          <Sequence durationInFrames={90} from={FEATURES_END} layout="none">
            <SceneCta />
          </Sequence>
          <Sequence durationInFrames={90} from={CTA_END} layout="none">
            <Logo />
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
