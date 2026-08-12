import { loadFont as loadGeistSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import type { CSSProperties } from "react";

// One load per face for every composition, wired to the CSS variables the
// scene components read (`var(--font-geist-sans)` and friends).

const { fontFamily: GEIST_SANS } = loadGeistSans("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700"],
});
const { fontFamily: GEIST_MONO } = loadGeistMono("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700"],
});
const { fontFamily: INSTRUMENT_SERIF } = loadInstrumentSerif("normal", {
  subsets: ["latin"],
  weights: ["400"],
});

export const SANS =
  "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif";

// Asserted because CSSProperties doesn't type custom `--*` keys.
export const FONT_VARS = {
  "--font-geist-mono": GEIST_MONO,
  "--font-geist-sans": GEIST_SANS,
  "--font-serif": INSTRUMENT_SERIF,
} as CSSProperties;
