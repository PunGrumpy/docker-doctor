import {
  Geist as createSans,
  Instrument_Serif as createSerif,
  Geist_Mono as createMono,
} from "next/font/google";

import { cn } from "./utils";

const sans = createSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = createMono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const serif = createSerif({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
});

export const fonts = cn(
  sans.variable,
  mono.variable,
  serif.variable,
  // `style` (not `none`): no italic faces are loaded, so with synthesis
  // fully off every <em> would render upright and emphasis would vanish.
  // Weight/small-caps synthesis stays off — all used weights are real.
  "touch-manipulation font-sans antialiased [font-synthesis:style]"
);
