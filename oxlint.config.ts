import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import nextJsPlugins from "ultracite/oxlint/next/js-plugins";
import react from "ultracite/oxlint/react";

export default defineConfig({
  env: core.env,
  extends: [core, next, react, nextJsPlugins],
  ignorePatterns: [
    ".cursor/hooks",
    // Deliberately malformed inputs for the CLI's end-to-end tests.
    "packages/docker-doctor/test/fixtures",
    "apps/web/components/ui",
    "packages/videos/src/components",
    "packages/videos/src/lib/remocn-ui",
  ],
});
