import "react";

declare module "react" {
  // The CSS custom properties the videos' style objects set.
  interface CSSProperties {
    "--font-geist-mono"?: string;
    "--font-geist-sans"?: string;
    "--font-serif"?: string;
  }
}
