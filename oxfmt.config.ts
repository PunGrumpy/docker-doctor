import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ".cursor/hooks",
    // The CLI's end-to-end fixtures, some of them deliberately malformed.
    "packages/docker-doctor/test/fixtures",
    "apps/web/components/ui",
    "packages/videos/src/components",
    "packages/videos/src/lib/remocn-ui",
  ],
});
