import { loadFont as loadSans } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";

// Loading injects the @font-face rules; the family names line up with the
// `--font-*` tokens in style.css, so Tailwind's font utilities resolve to
// the real fonts once these have loaded.
export const sans = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
});
export const mono = loadMono("normal", {
  weights: ["400", "500", "600", "700"],
});
export const serif = loadSerif("normal", { weights: ["400"] });

export const waitForFonts = () =>
  Promise.all([
    sans.waitUntilDone(),
    mono.waitUntilDone(),
    serif.waitUntilDone(),
  ]);
