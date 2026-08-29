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

// The v0.5.0 release video, styled after basement.studio's dev-conf work
// (Next.js Conf, Vercel Ship): a pure-black stage, one glowing gradient hero
// object — the doctor's cross standing in for the conf triangle — chrome type
// with a specular sweep, a perspective grid floor, HUD corner labels in mono,
// and slow cinematic light. Everything emerges from darkness; nothing slams.

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

const BLACK = "#000";
const PAPER = "#ededed";
const FAINT = "rgba(237,237,237,0.38)";
const DIM = "rgba(237,237,237,0.16)";

// The spectrum the cross glows in — cyan through violet, the conf-stage rim
// light, leaning blue for Docker.
const SPECTRUM =
  "linear-gradient(120deg, #00dfd8 0%, #4d7cfe 45%, #b45cff 100%)";
const GLOW_CYAN = "rgba(0,223,216,0.5)";
const GLOW_VIOLET = "rgba(180,92,255,0.4)";

// ─── Stage dressing ─────────────────────────────────────────────────────────

// Cinematic sensor noise, far subtler than film grain.
const Noise = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.03, pointerEvents: "none" }}>
      <svg height="100%" width="100%">
        <filter id="noise">
          <feTurbulence
            baseFrequency="0.8"
            numOctaves="2"
            seed={Math.floor(frame / 2)}
            type="fractalNoise"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect filter="url(#noise)" height="100%" width="100%" />
      </svg>
    </AbsoluteFill>
  );
};

// Perspective grid floor fading up into black — the conf-stage horizon.
const GridFloor = ({ opacity = 1 }: { readonly opacity?: number }) => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.6) % 48;
  return (
    <div
      style={{
        bottom: 0,
        height: 240,
        left: "-50%",
        opacity,
        overflow: "hidden",
        position: "absolute",
        width: "200%",
      }}
    >
      <div
        style={{
          backgroundImage: `repeating-linear-gradient(to right, ${DIM} 0 1px, transparent 1px 96px), repeating-linear-gradient(to bottom, ${DIM} 0 1px, transparent 1px 48px)`,
          backgroundPositionY: drift,
          height: "300%",
          transform: "perspective(420px) rotateX(62deg)",
          transformOrigin: "top center",
          width: "100%",
        }}
      />
      <div
        style={{
          background: `linear-gradient(to bottom, ${BLACK} 0%, transparent 90%)`,
          inset: 0,
          position: "absolute",
        }}
      />
    </div>
  );
};

// A soft pool of colored light behind the subject.
const GlowPool = ({ opacity = 1 }: { readonly opacity?: number }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 46% 34% at 50% 52%, ${GLOW_CYAN} 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 54% 48%, ${GLOW_VIOLET} 0%, transparent 60%)`,
      filter: "blur(24px)",
      opacity: opacity * 0.5,
    }}
  />
);

const Vignette = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 75% 70% at 50% 46%, transparent 55%, rgba(0,0,0,0.85) 100%)",
      pointerEvents: "none",
    }}
  />
);

// A horizontal light streak sweeping across the stage once.
const LightStreak = ({
  at,
  y,
}: {
  readonly at: number;
  readonly y: number;
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 40], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(
    frame,
    [at, at + 8, at + 32, at + 40],
    [0, 0.5, 0.5, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  return (
    <div
      style={{
        background: `linear-gradient(90deg, transparent, ${GLOW_CYAN}, transparent)`,
        filter: "blur(6px)",
        height: 2,
        left: `${t - 20}%`,
        opacity,
        position: "absolute",
        top: y,
        width: "40%",
      }}
    />
  );
};

// HUD corner labels — the quiet mono chrome around every conf-site viewport.
const Hud = () => (
  <>
    {[
      { style: { left: 48, top: 40 }, text: "DOCKER DOCTOR" },
      { style: { right: 48, top: 40 }, text: "REL/0.5.0" },
      { style: { bottom: 40, left: 48 }, text: "COMPOSE + AI AGENTS" },
      { style: { bottom: 40, right: 48 }, text: "31 RULES / 0 SETUP" },
    ].map(({ text, style }) => (
      <div
        key={text}
        style={{
          color: FAINT,
          fontFamily: MONO,
          fontSize: 13,
          letterSpacing: "0.14em",
          position: "absolute",
          ...style,
        }}
      >
        {text}
      </div>
    ))}
  </>
);

// ─── Hero object ────────────────────────────────────────────────────────────

// The doctor's cross as the conf hero object: a gradient-rimmed plus, glowing
// bloom behind it, breathing slowly. Two rounded bars, blur layers for bloom.
const Cross = ({
  size = 190,
  entrance = 0,
}: {
  readonly size?: number;
  readonly entrance?: number;
}) => {
  const frame = useCurrentFrame() - entrance;
  const scale = interpolate(frame, [0, 40], [0.85, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breathe = 1 + 0.015 * Math.sin(frame / 22);
  const bar = size * 0.3;
  const arm = (layer: "bloom" | "core"): CSSProperties => ({
    background: SPECTRUM,
    borderRadius: bar / 2,
    filter: layer === "bloom" ? "blur(26px)" : undefined,
    opacity: layer === "bloom" ? 0.8 : 1,
    position: "absolute",
  });
  return (
    <div
      style={{
        height: size,
        opacity,
        position: "relative",
        transform: `scale(${scale * breathe})`,
        width: size,
      }}
    >
      {(["bloom", "core"] as const).map((layer) => (
        <div key={layer} style={{ inset: 0, position: "absolute" }}>
          <div
            style={{
              ...arm(layer),
              height: bar,
              left: 0,
              top: (size - bar) / 2,
              width: size,
            }}
          />
          <div
            style={{
              ...arm(layer),
              height: size,
              left: (size - bar) / 2,
              top: 0,
              width: bar,
            }}
          />
        </div>
      ))}
      {/* Dark core inset so the cross reads as rim-lit, not flat-filled. */}
      <div style={{ inset: 5, position: "absolute" }}>
        <div
          style={{
            background: "rgba(0,0,0,0.82)",
            borderRadius: (bar - 10) / 2,
            height: bar - 10,
            left: 0,
            position: "absolute",
            top: (size - 10 - (bar - 10)) / 2,
            width: size - 10,
          }}
        />
        <div
          style={{
            background: "rgba(0,0,0,0.82)",
            borderRadius: (bar - 10) / 2,
            height: size - 10,
            left: (size - 10 - (bar - 10)) / 2,
            position: "absolute",
            top: 0,
            width: bar - 10,
          }}
        />
      </div>
    </div>
  );
};

// ─── Type ───────────────────────────────────────────────────────────────────

// Chrome display type: metallic vertical gradient with a specular band
// sweeping across once, rising softly out of the dark.
const ChromeLine = ({
  text,
  delay = 0,
  fontSize = 96,
  sweepAt = 20,
}: {
  readonly text: string;
  readonly delay?: number;
  readonly fontSize?: number;
  readonly sweepAt?: number;
}) => {
  const frame = useCurrentFrame() - delay;
  const opacity = interpolate(frame, [0, 22], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [0, 26], [26, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweep = interpolate(frame, [sweepAt, sweepAt + 34], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const base: CSSProperties = {
    fontFamily: SANS,
    fontSize,
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1.04,
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        opacity,
        position: "relative",
        transform: `translateY(${rise}px)`,
      }}
    >
      <div
        style={{
          ...base,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          backgroundImage:
            "linear-gradient(180deg, #fff 0%, #d9d9de 42%, #86868f 55%, #cfcfd6 70%, #f4f4f6 100%)",
          color: "transparent",
        }}
      >
        {text}
      </div>
      <div
        style={{
          ...base,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          backgroundImage: `linear-gradient(105deg, transparent ${sweep - 14}%, rgba(255,255,255,0.95) ${sweep}%, transparent ${sweep + 14}%)`,
          color: "transparent",
          inset: 0,
          position: "absolute",
        }}
      >
        {text}
      </div>
    </div>
  );
};

const MonoTag = ({
  text,
  delay = 0,
  color = FAINT,
  fontSize = 17,
}: {
  readonly text: string;
  readonly delay?: number;
  readonly color?: string;
  readonly fontSize?: number;
}) => {
  const frame = useCurrentFrame() - delay;
  const opacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        color,
        fontFamily: MONO,
        fontSize,
        letterSpacing: "0.16em",
        opacity,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  );
};

const Centered = ({
  children,
  gap = 30,
}: {
  readonly children: ReactNode;
  readonly gap?: number;
}) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      flexDirection: "column",
      gap,
      justifyContent: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// ─── Scene 1 · Title ────────────────────────────────────────────────────────

const TITLE_DURATION = 150;

const SceneTitle = () => (
  <>
    <GlowPool />
    <Centered gap={38}>
      <Cross entrance={4} size={170} />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <ChromeLine
          delay={34}
          fontSize={104}
          sweepAt={30}
          text="Docker Doctor"
        />
        <MonoTag delay={56} text="v0.5.0 · release" />
      </div>
    </Centered>
    <LightStreak at={26} y={170} />
    <LightStreak at={70} y={540} />
  </>
);

// ─── Scene 2 · Theme ────────────────────────────────────────────────────────

const THEME_DURATION = 105;

const SceneTheme = () => (
  <>
    <GlowPool opacity={0.7} />
    <Centered gap={26}>
      <MonoTag delay={0} text="this release" />
      <ChromeLine delay={6} fontSize={100} text="Compose + AI agents" />
      <MonoTag
        delay={26}
        text="the files your agents write, scanned before they ship"
      />
    </Centered>
    <LightStreak at={30} y={420} />
  </>
);

// ─── Scene 3 · Rule counter ─────────────────────────────────────────────────

const COUNT_DURATION = 90;

const SceneCount = () => {
  const frame = useCurrentFrame();
  const value = Math.round(
    interpolate(frame, [10, 48], [25, 31], {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const glow = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <>
      <GlowPool opacity={0.5 + glow * 0.5} />
      <Centered gap={20}>
        <div
          style={{
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            backgroundImage: SPECTRUM,
            color: "transparent",
            fontFamily: SANS,
            fontSize: 300,
            fontWeight: 700,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            textShadow: "none",
          }}
        >
          {value}
        </div>
        <MonoTag delay={44} text="rules · six new for Compose, zero setup" />
      </Centered>
    </>
  );
};

// ─── Scene 4 · Feature panels ───────────────────────────────────────────────

const FEATURES: { title: string; caption: string }[] = [
  {
    caption: "privileged mode · docker.sock mounts · plaintext secrets",
    title: "Compose security",
  },
  {
    caption: "the models: element, weights pinned like images",
    title: "AI models in Compose",
  },
  {
    caption: "dhi.io runtime images scan clean, nonroot by default",
    title: "Hardened images",
  },
  {
    caption: 'ignore: files: ["vendored/**"] · implemented at last',
    title: "ignore.files",
  },
  {
    caption: "--score exits 1 on errors, the same gate as every mode",
    title: "CI-true exit codes",
  },
];

const PANEL_DURATION = 78;
const FEATURES_DURATION = PANEL_DURATION * FEATURES.length;

// A hairline panel emerging from dark with a gradient edge-light running
// along its top border — the conf-site card language.
const FeaturePanel = ({
  index,
  title,
  caption,
}: {
  readonly index: number;
  readonly title: string;
  readonly caption: string;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [0, 22], [18, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const edge = interpolate(frame, [6, 40], [0, 100], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <Centered>
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${DIM}`,
          borderRadius: 14,
          opacity,
          overflow: "hidden",
          padding: "56px 84px 60px",
          position: "relative",
          transform: `translateY(${rise}px)`,
          width: 880,
        }}
      >
        <div
          style={{
            background: SPECTRUM,
            height: 2,
            left: 0,
            position: "absolute",
            top: 0,
            width: `${edge}%`,
          }}
        />
        <div
          style={{
            color: FAINT,
            fontFamily: MONO,
            fontSize: 15,
            letterSpacing: "0.16em",
            marginBottom: 26,
          }}
        >
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(FEATURES.length).padStart(2, "0")}
        </div>
        <ChromeLine delay={4} fontSize={58} sweepAt={14} text={title} />
        <div
          style={{
            color: FAINT,
            fontFamily: MONO,
            fontSize: 19,
            letterSpacing: "0.02em",
            marginTop: 24,
          }}
        >
          {caption}
        </div>
      </div>
    </Centered>
  );
};

const SceneFeatures = () => (
  <>
    <GlowPool opacity={0.45} />
    {FEATURES.map((feature, i) => (
      <Sequence
        durationInFrames={PANEL_DURATION}
        from={i * PANEL_DURATION}
        key={feature.title}
        layout="none"
      >
        <FeaturePanel
          caption={feature.caption}
          index={i}
          title={feature.title}
        />
      </Sequence>
    ))}
  </>
);

// ─── Scene 5 · CTA + outro ──────────────────────────────────────────────────

const CTA_DURATION = 110;
const OUT_DURATION = 110;

// Typewriter hardcodes the sans variable; point it at mono for the command.
const SceneCta = () => (
  <>
    <GlowPool opacity={0.4} />
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
        cursorColor="#00dfd8"
        fontSize={46}
        text="bunx @docker-doctor/cli"
      />
    </div>
  </>
);

const SceneOut = () => (
  <>
    <GlowPool />
    <Centered gap={36}>
      <Cross entrance={0} size={130} />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <ChromeLine
          delay={16}
          fontSize={92}
          sweepAt={40}
          text="v0.5.0 · out now"
        />
        <MonoTag delay={40} text="docker-doctor.vercel.app" />
      </div>
    </Centered>
    <LightStreak at={30} y={190} />
  </>
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
          <GridFloor />
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
          <Hud />
          <Vignette />
        </div>
      </AbsoluteFill>
      <Noise />
    </AbsoluteFill>
  );
};
