import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ".cursor/hooks",
    "apps/web/components/ui",
    "packages/videos/src/components",
    "packages/videos/src/lib/remocn-ui",
  ],
});
