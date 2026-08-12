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
import {
  SANDBOX_AGENT_DURATION,
  SANDBOX_BOOT_DURATION,
  SandboxAgent,
  SandboxBoot,
} from "./scenes/sandbox-terminal";

// The Docker Sandboxes kit announcement cut — square, so it takes the feed
// height a 16:9 crop gives away. Same backdrop, type, and frosted terminal as
// the launch video; a different story: the agent lints itself, unprompted.

const INK = "rgba(0,0,0,0.85)";
const MUTED = "rgba(0,0,0,0.55)";
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
// The post's hook, in the launch video's two-line rhythm: the statement lands,
// then the question follows a beat later.
const SceneHook = () => (
  <>
    <Positioned dy={-40}>
      <SoftBlurIn color={INK} fontSize={54} text="Your agent writes" />
    </Positioned>
    <Sequence from={6} layout="none">
      <Positioned dy={16}>
        <SoftBlurIn color={INK} fontSize={54} text="Dockerfiles now." />
      </Positioned>
    </Sequence>
    <Sequence from={26} layout="none">
      <Positioned dy={78}>
        <SoftBlurIn color={MUTED} fontSize={44} text="Who reviews them?" />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 4 · The payoff ───────────────────────────────────────────────────
const PAYOFF_DURATION = 68;

const ScenePayoff = () => (
  <>
    <Positioned dy={-26}>
      <SoftBlurIn color={INK} fontSize={58} text="Nobody asked it to." />
    </Positioned>
    <Sequence from={10} layout="none">
      <Positioned dy={40}>
        <SoftBlurIn
          color={MUTED}
          fontSize={40}
          text="The kit did, once, at boot."
        />
      </Positioned>
    </Sequence>
  </>
);

// ─── Scene 5 · The close ────────────────────────────────────────────────────
// The command on a pill, at a size that survives a phone screen — it already
// typed out legibly in scene 2, so this is a reminder, not the reveal.
const CTA_DURATION = 86;

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
      <SoftBlurIn color={INK} fontSize={52} text="One command." />
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
const HOOK_END = 74;
const BOOT_END = HOOK_END + SANDBOX_BOOT_DURATION;
const AGENT_END = BOOT_END + SANDBOX_AGENT_DURATION;
const PAYOFF_END = AGENT_END + PAYOFF_DURATION;
const CTA_END = PAYOFF_END + CTA_DURATION;
export const DURATION = CTA_END + 62;

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
            durationInFrames={SANDBOX_BOOT_DURATION}
            from={HOOK_END}
            layout="none"
          >
            <SandboxBoot />
          </Sequence>
          <Sequence
            durationInFrames={SANDBOX_AGENT_DURATION}
            from={BOOT_END}
            layout="none"
          >
            <SandboxAgent />
          </Sequence>
          <Sequence
            durationInFrames={PAYOFF_DURATION}
            from={AGENT_END}
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
          <Sequence durationInFrames={62} from={CTA_END} layout="none">
            <Logo />
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
