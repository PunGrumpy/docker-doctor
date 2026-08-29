import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Typewriter } from "./components/remocn/typewriter";
import { FONT_VARS, SANS } from "./fonts";

// The v0.5.0 release video, styled after basement.studio: near-black stage,
// heavy Geist stacked caps slamming in on hard cuts, marquee
// strips top and bottom, film grain, one orange accent. No fades anywhere —
// every scene change is a cut, every reveal is a clip-mask slam.

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const BLACK = "#0d0d0d";
const PAPER = "#fbfbf9";
const ORANGE = "#ff4d00";
const FAINT = "rgba(251,251,249,0.34)";
const HAIRLINE = "rgba(251,251,249,0.16)";

// ─── Texture ────────────────────────────────────────────────────────────────

// Film grain: SVG turbulence re-seeded every other frame so the noise
// crawls like scanned film instead of sitting frozen on the frame.
const Grain = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2);
  return (
    <AbsoluteFill style={{ opacity: 0.055, pointerEvents: "none" }}>
      <svg height="100%" width="100%">
        <filter id="grain">
          <feTurbulence
            baseFrequency="0.8"
            numOctaves="2"
            seed={seed}
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect filter="url(#grain)" height="100%" width="100%" />
      </svg>
    </AbsoluteFill>
  );
};

// Corner crosshairs — the registration marks basement frames everything with.
const Crosshair = ({ x, y }: { readonly x: number; readonly y: number }) => (
  <div
    style={{
      color: FAINT,
      fontFamily: MONO,
      fontSize: 22,
      left: x,
      position: "absolute",
      top: y,
      transform: "translate(-50%, -50%)",
    }}
  >
    +
  </div>
);

// ─── Marquee ────────────────────────────────────────────────────────────────

// Two identical halves shifted by their own width: translating by
// `-(t mod 50%)` loops seamlessly without measuring pixels.
const Marquee = ({
  phrase,
  pxPerFrame = 3,
  color = FAINT,
  flip = false,
}: {
  readonly phrase: string;
  readonly pxPerFrame?: number;
  readonly color?: string;
  readonly flip?: boolean;
}) => {
  const frame = useCurrentFrame();
  const half = Array.from({ length: 6 }, () => phrase).join("");
  const shift = ((frame * pxPerFrame) / 40) % 50;
  return (
    <div
      style={{
        borderBottom: flip ? "none" : `1px solid ${HAIRLINE}`,
        borderTop: flip ? `1px solid ${HAIRLINE}` : "none",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      <div
        style={{
          color,
          display: "inline-flex",
          fontFamily: SANS,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: "0.06em",
          padding: "9px 0",
          textTransform: "uppercase",
          transform: `translateX(${flip ? shift - 50 : -shift}%)`,
        }}
      >
        <span style={{ whiteSpace: "pre" }}>{half}</span>
        <span style={{ whiteSpace: "pre" }}>{half}</span>
      </div>
    </div>
  );
};

// ─── Type ───────────────────────────────────────────────────────────────────

// Cap a display line's font size so it bleeds close to the frame edge but
// never clips: Geist bold caps average ~0.62em per character.
const SAFE_W = 1150;
const CHAR_EM = 0.62;
const fitSize = (text: string, max: number): number =>
  Math.min(max, SAFE_W / (text.length * CHAR_EM));

// A line of display caps revealed by a clip-mask slam: the text rises out of
// an overflow-hidden slot in 8 frames and settles hard. basement's signature
// move — nothing fades, everything arrives.
const SlamLine = ({
  text,
  delay = 0,
  fontSize = 150,
  color = PAPER,
  align = "center",
}: {
  readonly text: string;
  readonly delay?: number;
  readonly fontSize?: number;
  readonly color?: string;
  readonly align?: "left" | "center";
}) => {
  const frame = useCurrentFrame() - delay;
  const y = interpolate(frame, [0, 8], [110, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ overflow: "hidden", textAlign: align }}>
      <div
        style={{
          color,
          fontFamily: SANS,
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 0.92,
          textTransform: "uppercase",
          transform: `translateY(${y}%)`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </div>
  );
};

const MonoCaption = ({
  text,
  delay = 0,
  color = FAINT,
}: {
  readonly text: string;
  readonly delay?: number;
  readonly color?: string;
}) => {
  const frame = useCurrentFrame() - delay;
  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        color,
        fontFamily: MONO,
        fontSize: 22,
        letterSpacing: "0.02em",
        opacity,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
};

const Centered = ({ children }: { readonly children: ReactNode }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      flexDirection: "column",
      gap: 26,
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// ─── Scene 1 · Title ────────────────────────────────────────────────────────

const TITLE_DURATION = 80;

const SceneTitle = () => (
  <Centered>
    <SlamLine fontSize={190} text="Docker" />
    <SlamLine delay={5} fontSize={190} text="Doctor" />
    <SlamLine color={ORANGE} delay={14} fontSize={90} text="v0.5.0" />
  </Centered>
);

// ─── Scene 2 · Theme ────────────────────────────────────────────────────────

const THEME_DURATION = 70;

const SceneTheme = () => (
  <Centered>
    <SlamLine fontSize={fitSize("Compose", 165)} text="Compose" />
    <SlamLine
      delay={5}
      fontSize={fitSize("+ AI agents", 165)}
      text="+ AI agents"
    />
    <MonoCaption delay={16} text="one release. two fronts." />
  </Centered>
);

// ─── Scene 3 · Rule counter ─────────────────────────────────────────────────

const COUNT_DURATION = 60;

const SceneCount = () => {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [6, 30], [25, 31], {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  return (
    <Centered>
      <div
        style={{
          color: PAPER,
          fontFamily: SANS,
          fontSize: 330,
          fontWeight: 700,
          lineHeight: 0.88,
        }}
      >
        {value}
        <span style={{ color: ORANGE }}>.</span>
      </div>
      <MonoCaption delay={26} text="rules. zero setup. six new for Compose." />
    </Centered>
  );
};

// ─── Scene 4 · Feature slams ────────────────────────────────────────────────

const FEATURES: { title: string; caption: string }[] = [
  {
    caption: "privileged mode / docker.sock mounts / plaintext secrets",
    title: "Compose security",
  },
  {
    caption: "models: element / Docker Model Runner / pinned weights",
    title: "AI models",
  },
  {
    caption: "dhi.io runtime images scan clean, nonroot by default",
    title: "Hardened images",
  },
  {
    caption: 'ignore: files: ["vendored/**"] / now actually implemented',
    title: "ignore.files",
  },
  {
    caption: "--score exits 1 on errors, same gate as every mode",
    title: "CI-true exits",
  },
];

const SLAM_DURATION = 55;
const FEATURES_DURATION = SLAM_DURATION * FEATURES.length;

const FeatureSlam = ({
  index,
  title,
  caption,
}: {
  readonly index: number;
  readonly title: string;
  readonly caption: string;
}) => (
  <Centered>
    <div
      style={{
        color: ORANGE,
        fontFamily: MONO,
        fontSize: 26,
        letterSpacing: "0.08em",
      }}
    >
      {String(index + 1).padStart(2, "0")} /{" "}
      {String(FEATURES.length).padStart(2, "0")}
    </div>
    <SlamLine delay={2} fontSize={fitSize(title, 135)} text={title} />
    <MonoCaption delay={12} text={caption} />
  </Centered>
);

const SceneFeatures = () => (
  <>
    {FEATURES.map((feature, i) => (
      <Sequence
        durationInFrames={SLAM_DURATION}
        from={i * SLAM_DURATION}
        key={feature.title}
        layout="none"
      >
        <FeatureSlam
          caption={feature.caption}
          index={i}
          title={feature.title}
        />
      </Sequence>
    ))}
  </>
);

// ─── Scene 5 · CTA ──────────────────────────────────────────────────────────

const CTA_DURATION = 100;
const OUT_DURATION = 80;

// Typewriter hardcodes the sans variable, so point that variable at the mono
// face for this subtree — the command should read as a terminal line.
const SceneCta = () => (
  <Sequence durationInFrames={CTA_DURATION} layout="none">
    <div
      style={
        {
          "--font-geist-sans": "var(--font-geist-mono)",
          inset: 0,
          position: "absolute",
        } as CSSProperties
      }
    >
      <Typewriter
        background="transparent"
        charsPerSecond={18}
        color={PAPER}
        cursorColor={ORANGE}
        fontSize={54}
        text="bunx @docker-doctor/cli"
      />
    </div>
  </Sequence>
);

const SceneOut = () => (
  <Centered>
    <SlamLine fontSize={210} text="Out now" />
    <SlamLine color={ORANGE} delay={6} fontSize={92} text="v0.5.0" />
  </Centered>
);

// ─── Composition ────────────────────────────────────────────────────────────

export const V050_FPS = 30;
export const V050_WIDTH = 1920;
export const V050_HEIGHT = 1080;

const THEME_END = TITLE_DURATION + THEME_DURATION;
const COUNT_END = THEME_END + COUNT_DURATION;
const FEATURES_END = COUNT_END + FEATURES_DURATION;
const CTA_END = FEATURES_END + CTA_DURATION;
export const V050_DURATION = CTA_END + OUT_DURATION;

const MARQUEE = "docker doctor v0.5.0 ✦ compose + ai agents ✦ ";

// Authored against the same 16:9 reference stage as the launch video, scaled
// uniformly to the output resolution.
const REF_W = 1280;
const REF_H = 720;

export const V050 = () => {
  const { width } = useVideoConfig();
  const stageScale = width / REF_W;

  return (
    <AbsoluteFill
      style={{ ...FONT_VARS, backgroundColor: BLACK } as CSSProperties}
    >
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
          <Sequence durationInFrames={TITLE_DURATION} layout="none">
            <SceneTitle />
          </Sequence>
          <Sequence
            durationInFrames={THEME_DURATION}
            from={TITLE_DURATION}
            layout="none"
          >
            <SceneTheme />
          </Sequence>
          <Sequence
            durationInFrames={COUNT_DURATION}
            from={THEME_END}
            layout="none"
          >
            <SceneCount />
          </Sequence>
          <Sequence
            durationInFrames={FEATURES_DURATION}
            from={COUNT_END}
            layout="none"
          >
            <SceneFeatures />
          </Sequence>
          <Sequence
            durationInFrames={CTA_DURATION}
            from={FEATURES_END}
            layout="none"
          >
            <SceneCta />
          </Sequence>
          <Sequence
            durationInFrames={OUT_DURATION}
            from={CTA_END}
            layout="none"
          >
            <SceneOut />
          </Sequence>

          {/* Chrome that rides above every scene: marquees, crosshairs. */}
          <div style={{ left: 0, position: "absolute", right: 0, top: 0 }}>
            <Marquee phrase={MARQUEE} />
          </div>
          <div style={{ bottom: 0, left: 0, position: "absolute", right: 0 }}>
            <Marquee flip phrase={MARQUEE} />
          </div>
          <Crosshair x={64} y={86} />
          <Crosshair x={REF_W - 64} y={86} />
          <Crosshair x={64} y={REF_H - 86} />
          <Crosshair x={REF_W - 64} y={REF_H - 86} />
        </div>
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};
