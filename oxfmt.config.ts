import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ".cursor/hooks",
    // Deliberately malformed inputs for the CLI's end-to-end tests.
    "packages/docker-doctor/test/fixtures",
    "apps/web/components/ui",
    "packages/videos/src/components",
    "packages/videos/src/lib/remocn-ui",
  ],
});
