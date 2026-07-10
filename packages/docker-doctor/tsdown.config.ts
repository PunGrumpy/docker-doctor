import { defineConfig } from "tsdown";

export default defineConfig({
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  deps: {
    alwaysBundle: ["@docker-doctor/core"],
  },
  dts: {
    eager: true,
  },
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  minify: false,
  shims: true,
  sourcemap: true,
  target: "es2022",
});
