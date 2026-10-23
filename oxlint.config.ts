import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import gdp from "ultracite/oxlint/gdp";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import next from "ultracite/oxlint/next";
import nextJsPlugins from "ultracite/oxlint/next/js-plugins";
import react from "ultracite/oxlint/react";

const jsPlugins = selectJsPlugins(["github", "sonarjs", "react-doctor"]);

export default defineConfig({
  env: core.env,
  extends: [core, next, react, nextJsPlugins, antiSlop, gdp, jsPlugins],
  ignorePatterns: [
    ".cursor/hooks",
    // The CLI's end-to-end fixtures, some of them deliberately malformed.
    "packages/docker-doctor/test/fixtures",
    "apps/web/components/ui",
    "packages/videos/src/components",
    "packages/videos/src/lib/remocn-ui",
  ],
  jsPlugins: jsPlugins.jsPlugins,
  options: { typeAware: true },
  overrides: [
    {
      files: ["apps/web/app/docs/layout.tsx"],
      // The skip link is shown on focus, which the rule cannot see.
      rules: { "github/a11y-no-visually-hidden-interactive-element": "off" },
    },
    {
      files: ["apps/web/components/sections/terminal-demo.tsx"],
      // The demo mimics a terminal status line. Its small sizes are part of
      // the picture.
      rules: { "react-doctor/no-tiny-text": "off" },
    },
  ],
  settings: jsPluginSettings,
});
