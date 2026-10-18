import "react";

declare module "react" {
  // The CSS custom properties the website's style objects set.
  interface CSSProperties {
    "--beam-delay"?: string;
    "--beam-end"?: string;
    "--beam-start"?: string;
  }
}
