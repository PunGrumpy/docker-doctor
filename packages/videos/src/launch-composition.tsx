import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { SoftBlurIn } from "./components/remocn/soft-blur-in";
import { MONO } from "./components/terminal-card";
import { FONT_VARS } from "./fonts";
import { LAUNCH_RUN_DURATION, LaunchRun } from "./scenes/launch-terminal";
import { Logo } from "./scenes/logo";

// The social launch cut for X and LinkedIn — square and silent, since both
// feeds autoplay muted, and short enough to loop. Same backdrop, type, and
// frosted terminal as the other cuts; the story is the post's first line and
// then the loop that answers it.

const INK = "rgba(0,0,0,0.85)";
const ACCENT = "#2563eb";
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const SCAN_COMMAND = "npx @docker-doctor/cli@latest";

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

// ─── Scene 1 · The hook ─────────────────────────────────────────────────────
// The post's opening question. SoftBlurIn needs ~45 frames to land a
// 17-character line, so the scene is sized to the last line's arrival plus a
// one-second hold.
const LINE_SIZE = 56;
const HOOK_DURATION = 96;

const SceneHook = () => (
  <>
    <Positioned dy={-62}>
      <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Your agent writes" />
    </Positioned>
    <Sequence from={5} layout="none">
      <Positioned dy={0}>
        <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Dockerfiles now." />
      </Positioned>
    </Sequence>
    <Sequence from={20} layout="none">
      <Positioned dy={62}>
        <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Who reviews them?" />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 3 · The close ────────────────────────────────────────────────────
// The command on a pill, large enough to read on a phone — it already typed
// out in the terminal, so this is the thing to copy, not the reveal.
const CTA_DURATION = 66;

const CommandPill = () => {
  const frame = useCurrentFrame();
  const clamp = {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const opacity = interpolate(frame, [0, 14], [0, 1], clamp);
  const y = interpolate(frame, [0, 14], [14, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        transform: "translateY(54px)",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.82)",
          border: "1px solid rgba(255,255,255,0.85)",
          borderRadius: 16,
          boxShadow: "0 18px 44px rgba(30,40,60,0.18)",
          opacity,
          padding: "22px 32px",
          transform: `translateY(${y}px)`,
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 34 }}>
          {"$ "}
        </span>
        <span style={{ color: INK, fontFamily: MONO, fontSize: 34 }}>
          {SCAN_COMMAND}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const SceneCta = () => (
  <>
    <Positioned dy={-62}>
      <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="One command." />
    </Positioned>
    <Sequence from={6} layout="none">
      <CommandPill />
    </Sequence>
  </>
);

const LOGO_DURATION = 66;

// Every scene is authored against this square reference stage and scaled
// uniformly to whatever 1:1 resolution the composition is set to.
const REF = 1080;

export const FPS = 30;
export const SIZE = 1080;

// Scene starts, derived so the terminal scene can grow without hand-retiming
// everything after it.
const RUN_END = HOOK_DURATION + LAUNCH_RUN_DURATION;
const CTA_END = RUN_END + CTA_DURATION;
export const DURATION = CTA_END + LOGO_DURATION;

export const Launch = () => {
  const { width } = useVideoConfig();
  const stageScale = width / REF;

  return (
    <AbsoluteFill style={FONT_VARS}>
      <AbsoluteFill>
        <Img
          src={staticFile("background.png")}
          style={{ height: "100%", objectFit: "cover", width: "100%" }}
        />
      </AbsoluteFill>

      <AbsoluteFill>
        <div
          style={{
            height: REF,
            position: "relative",
            transform: `scale(${stageScale})`,
            transformOrigin: "top left",
            width: REF,
          }}
        >
          <Sequence durationInFrames={HOOK_DURATION} layout="none">
            <SceneHook />
          </Sequence>
          <Sequence
            durationInFrames={LAUNCH_RUN_DURATION}
            from={HOOK_DURATION}
            layout="none"
          >
            <LaunchRun />
          </Sequence>
          <Sequence
            durationInFrames={CTA_DURATION}
            from={RUN_END}
            layout="none"
          >
            <SceneCta />
          </Sequence>
          <Sequence
            durationInFrames={LOGO_DURATION}
            from={CTA_END}
            layout="none"
          >
            <Logo urlSize={30} />
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
