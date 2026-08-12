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
import { Logo } from "./scenes/logo";
import { SANDBOX_RUN_DURATION, SandboxRun } from "./scenes/sandbox-terminal";

// The Docker Sandboxes kit announcement cut — square, so it takes the feed
// height a 16:9 crop gives away. Same backdrop, type, and frosted terminal as
// the launch video; a different story: the agent lints itself, unprompted.

const INK = "rgba(0,0,0,0.85)";
const ACCENT = "#2563eb";
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const KIT_COMMAND =
  "sbx run --kit docker.io/pungrumpy/docker-doctor-kit:latest claude";

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

// ─── Scene 1 · The setup ────────────────────────────────────────────────────
// The post's hook, in the launch video's rhythm: one size, one color, and the
// timing alone carries the beat — a smaller, dimmer last line would read as a
// subtitle when it is the actual question.
const LINE_SIZE = 52;

const SceneHook = () => (
  <>
    <Positioned dy={-58}>
      <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Your agent writes" />
    </Positioned>
    <Sequence from={6} layout="none">
      <Positioned dy={0}>
        <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Dockerfiles now." />
      </Positioned>
    </Sequence>
    <Sequence from={26} layout="none">
      <Positioned dy={58}>
        <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Who reviews them?" />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 4 · The payoff ───────────────────────────────────────────────────
// SoftBlurIn spends ~27 frames per character plus a frame of stagger each, so
// a 20-character line is not fully on screen for ~47 frames. Every text scene
// below is sized to that arrival plus a two-second hold; at the old durations
// the last line landed and the scene cut almost immediately.
const PAYOFF_DURATION = 122;

const ScenePayoff = () => (
  <>
    <Positioned dy={-29}>
      <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="Nobody asked it to." />
    </Positioned>
    <Sequence from={10} layout="none">
      <Positioned dy={29}>
        <SoftBlurIn
          color={INK}
          fontSize={LINE_SIZE}
          text="The kit already did."
        />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 5 · The close ────────────────────────────────────────────────────
// The command on a pill, at a size that survives a phone screen — it already
// typed out legibly in scene 2, so this is a reminder, not the reveal.
const CTA_DURATION = 112;

const CommandPill = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 18], [14, 0], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
          borderRadius: 14,
          boxShadow: "0 18px 44px rgba(30,40,60,0.18)",
          opacity,
          padding: "18px 26px",
          transform: `translateY(${y}px)`,
          whiteSpace: "pre",
        }}
      >
        <span style={{ color: ACCENT, fontFamily: MONO, fontSize: 20 }}>
          {"$ "}
        </span>
        <span style={{ color: INK, fontFamily: MONO, fontSize: 20 }}>
          {KIT_COMMAND}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const SceneCta = () => (
  <>
    <Positioned dy={-56}>
      <SoftBlurIn color={INK} fontSize={LINE_SIZE} text="One command." />
    </Positioned>
    <Sequence from={10} layout="none">
      <CommandPill />
    </Sequence>
  </>
);

// Every scene is authored against this square reference stage and scaled
// uniformly to whatever 1:1 resolution the composition is set to.
const REF = 1080;

export const FPS = 30;
export const SIZE = 1080;

// Scene starts, derived so the terminal scenes can grow without hand-retiming
// everything after them.
const HOOK_END = 132;
const RUN_END = HOOK_END + SANDBOX_RUN_DURATION;
const PAYOFF_END = RUN_END + PAYOFF_DURATION;
const CTA_END = PAYOFF_END + CTA_DURATION;
export const DURATION = CTA_END + 78;

export const SandboxKit = () => {
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
          <Sequence durationInFrames={HOOK_END} layout="none">
            <SceneHook />
          </Sequence>
          <Sequence
            durationInFrames={SANDBOX_RUN_DURATION}
            from={HOOK_END}
            layout="none"
          >
            <SandboxRun />
          </Sequence>
          <Sequence
            durationInFrames={PAYOFF_DURATION}
            from={RUN_END}
            layout="none"
          >
            <ScenePayoff />
          </Sequence>
          <Sequence
            durationInFrames={CTA_DURATION}
            from={PAYOFF_END}
            layout="none"
          >
            <SceneCta />
          </Sequence>
          <Sequence durationInFrames={78} from={CTA_END} layout="none">
            <Logo urlSize={30} />
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
