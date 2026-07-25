import { AbsoluteFill } from "remotion";

/**
 * The gradient backdrop every scene rides on — blume uses a gradient photo;
 * we synthesize the same dusk-sky feel in CSS so the package stays
 * asset-free: deep navy base, blue/cyan glow fields, one warm horizon bloom,
 * and an edge vignette that keeps white text and frosted cards legible.
 */
export const Backdrop = () => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(160deg, #0b1226 0%, #10224e 34%, #0d3a5e 62%, #14293f 100%)",
    }}
  >
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 68% 55% at 22% 18%, rgba(59,130,246,0.52), transparent 68%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 55% 45% at 82% 12%, rgba(139,92,246,0.34), transparent 70%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 60% 42% at 75% 88%, rgba(34,211,238,0.30), transparent 70%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 45% 30% at 18% 92%, rgba(245,158,11,0.26), transparent 72%)",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(4,8,18,0.5) 100%)",
      }}
    />
  </AbsoluteFill>
);
