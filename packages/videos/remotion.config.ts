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

// Remotion's esbuild-loader reads tsconfig.json through the classic
// `typescript` API (`typescript.sys.readFile`), which typescript 7 (tsgo)
// no longer exports. Pre-supplying `tsconfigRaw` makes the loader skip
// that lookup entirely — esbuild parses the raw JSON itself.
const tsconfigRaw = fs.readFileSync(path.resolve("tsconfig.json"), "utf-8");

interface UseEntry {
  loader?: string;
  options?: Record<string, unknown>;
}
interface LoaderRule {
  use?: (UseEntry | string)[];
}

// Generic so the mapped rules keep the exact type the webpack config expects.
const withTsconfigRaw = <T>(rule: T): T => {
  const candidate = rule as LoaderRule | null | undefined;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !Array.isArray(candidate.use)
  ) {
    return rule;
  }
  return {
    ...candidate,
    use: candidate.use.map((entry) => {
      if (
        typeof entry === "string" ||
        !entry.loader?.includes("esbuild-loader")
      ) {
        return entry;
      }
      return { ...entry, options: { ...entry.options, tsconfigRaw } };
    }),
  } as T;
};

// enableTailwind + the `@/*` → `src/*` path alias the remocn components import
// each other with. Remotion's webpack does not read tsconfig `paths`, so the
// alias has to be wired in here or the component graph fails to resolve.
Config.overrideWebpackConfig((currentConfig) => {
  const withTailwind = enableTailwind(currentConfig);
  return {
    ...withTailwind,
    module: {
      ...withTailwind.module,
      rules: (withTailwind.module?.rules ?? []).map(withTsconfigRaw),
    },
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...withTailwind.resolve?.alias,
        "@": path.resolve("src"),
      },
    },
  };
});
