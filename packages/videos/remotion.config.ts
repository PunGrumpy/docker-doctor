/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import fs from "node:fs";
import path from "node:path";

import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

interface LoaderEntry {
  loader?: string;
  options?: Record<string, unknown>;
}

// enableTailwind + the `@/*` → `src/*` path alias the remocn components import
// each other with. Remotion's webpack does not read tsconfig `paths`, so the
// alias has to be wired in here or the component graph fails to resolve.
Config.overrideWebpackConfig((currentConfig) => {
  const withTailwind = enableTailwind(currentConfig);

  // Remotion's esbuild-loader reads tsconfig.json through the classic
  // `typescript` API (`typescript.sys.readFile`), which typescript 7 (tsgo)
  // no longer exports. Pre-supplying `tsconfigRaw` makes the loader skip
  // that lookup entirely — esbuild parses the raw JSON itself.
  const tsconfigRaw = fs.readFileSync(path.resolve("tsconfig.json"), "utf-8");
  for (const rule of withTailwind.module?.rules ?? []) {
    const use = typeof rule === "object" && rule ? rule.use : undefined;
    const entries = Array.isArray(use) ? (use as LoaderEntry[]) : [];
    for (const entry of entries) {
      if (entry.loader?.includes("esbuild-loader")) {
        entry.options = { ...entry.options, tsconfigRaw };
      }
    }
  }

  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...withTailwind.resolve?.alias,
        "@": path.resolve("src"),
      },
    },
  };
});
