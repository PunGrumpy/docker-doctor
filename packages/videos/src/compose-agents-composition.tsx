import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Typewriter } from "./components/remocn/typewriter";
import { FONT_VARS, SANS } from "./fonts";

// The v0.5.0 release video, styled after basement.studio: paper-white stage,
// heavy Geist stacked caps slamming in on hard cuts, marquee
// strips top and bottom, film grain, one brand-blue accent. No fades anywhere —
// every scene change is a cut, every reveal is a clip-mask slam.

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const BLACK = "#fbfbf9";
const PAPER = "#111110";
// The brand blue from the site mark (apps/web/components/logo.tsx).
const BRAND = "#2b7fff";
const FAINT = "rgba(17,17,16,0.38)";
const HAIRLINE = "rgba(17,17,16,0.14)";

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
    <SlamLine color={BRAND} delay={14} fontSize={90} text="v0.5.0" />
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
        <span style={{ color: BRAND }}>.</span>
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
        color: BRAND,
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

const CTA_TEXT = "bunx @docker-doctor/cli";
const CTA_CHARS_PER_SECOND = 18;

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
        charsPerSecond={CTA_CHARS_PER_SECOND}
        color={PAPER}
        cursorColor={BRAND}
        fontSize={54}
        text={CTA_TEXT}
      />
    </div>
  </Sequence>
);

const SceneOut = () => (
  <Centered>
    <SlamLine fontSize={210} text="Out now" />
    <SlamLine color={BRAND} delay={6} fontSize={92} text="v0.5.0" />
  </Centered>
);

// ─── Composition ────────────────────────────────────────────────────────────

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const THEME_END = TITLE_DURATION + THEME_DURATION;
const COUNT_END = THEME_END + COUNT_DURATION;
const FEATURES_END = COUNT_END + FEATURES_DURATION;
const CTA_END = FEATURES_END + CTA_DURATION;
export const DURATION = CTA_END + OUT_DURATION;

// ─── Sound ──────────────────────────────────────────────────────────────────

// A composed music bed plus two accents (scripts/make-sfx.py), in the
// product-launch style of ElevenLabs' videos: 22.5 s of minimal electronic
// in D minor at 96 BPM under the whole video, a soft sub thump on each
// scene cut, a rising pluck per counter increment, and a tiny key tick per
// typed CTA character. All sine-based, no noise sources. Social feeds
// autoplay muted, so the video must read silent; sound is texture.
const THUMP_FRAMES = [
  0,
  TITLE_DURATION,
  THEME_END,
  ...FEATURES.map((_, i) => COUNT_END + i * SLAM_DURATION),
  FEATURES_END,
  CTA_END,
];

// The rule counter gets its own voice: one clean bass pluck per increment,
// rising through D minor pentatonic and landing the octave on 31.
// The frames replicate SceneCount's interpolate so blips sit exactly on the
// displayed value changes.
const COUNT_EASE = (t: number): number => 1 - (1 - t) ** 2;
const COUNT_BLIPS: { frame: number; rate: number }[] = [];
const BLIP_RATES = [1, 6 / 5, 4 / 3, 3 / 2, 16 / 9, 2];
{
  let shown = 25;
  for (let f = 10; f <= 48 && COUNT_BLIPS.length < BLIP_RATES.length; f += 1) {
    const value = Math.round(25 + 6 * COUNT_EASE((f - 10) / 38));
    if (value > shown) {
      shown = value;
      COUNT_BLIPS.push({
        frame: THEME_END + f,
        rate: BLIP_RATES[COUNT_BLIPS.length],
      });
    }
  }
}

// One tick per typed character, mirroring the Typewriter's pacing exactly.
const TICK_FRAMES = Array.from(
  CTA_TEXT,
  (_, i) => FEATURES_END + Math.round((i * FPS) / CTA_CHARS_PER_SECOND)
);

// Slight deterministic pitch walk so repeated thumps stay organic.
const PITCH_STEPS = [1, 0.96, 1.04, 0.98];

const MUSIC_FADE_IN = 20;
const MUSIC_FADE_OUT = 60;

const musicVolume = (frame: number): number =>
  interpolate(
    frame,
    [0, MUSIC_FADE_IN, DURATION - MUSIC_FADE_OUT, DURATION - 5],
    [0, 0.35, 0.35, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

const Soundtrack = () => (
  <>
    <Audio src={staticFile("sfx/music.wav")} volume={musicVolume} />
    {COUNT_BLIPS.map(({ frame, rate }) => (
      <Sequence
        durationInFrames={10}
        from={frame}
        key={`blip-${frame}`}
        layout="none"
      >
        <Audio
          playbackRate={rate}
          src={staticFile("sfx/blip.wav")}
          volume={0.55}
        />
      </Sequence>
    ))}
    {TICK_FRAMES.map((from, i) => (
      <Sequence
        durationInFrames={3}
        from={from}
        key={`tick-${from}-${String(i)}`}
        layout="none"
      >
        <Audio
          playbackRate={i % 2 === 0 ? 1 : 0.93}
          src={staticFile("sfx/tick.wav")}
          volume={0.3}
        />
      </Sequence>
    ))}
    {THUMP_FRAMES.map((from, i) => (
      <Sequence
        durationInFrames={14}
        from={from}
        key={`thump-${from}`}
        layout="none"
      >
        <Audio
          playbackRate={PITCH_STEPS[i % PITCH_STEPS.length]}
          src={staticFile("sfx/thump.wav")}
          volume={0.6}
        />
      </Sequence>
    ))}
  </>
);

const MARQUEE = "docker doctor v0.5.0 ✦ compose + ai agents ✦ ";

// Authored against the same 16:9 reference stage as the launch video, scaled
// uniformly to the output resolution.
const REF_W = 1280;
const REF_H = 720;

export const ComposeAgents = () => {
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
        </div>
      </AbsoluteFill>
      <Grain />
      <Soundtrack />
    </AbsoluteFill>
  );
};
