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
  "touch-manipulation font-sans antialiased [font-synthesis:none]"
);
