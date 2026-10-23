import "react";

declare module "react" {
  interface CSSProperties {
    "--beam-delay"?: string;
    "--beam-end"?: string;
    "--beam-start"?: string;
  }
}
