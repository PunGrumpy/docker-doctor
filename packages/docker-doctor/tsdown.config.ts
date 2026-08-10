import { defineConfig } from "tsdown";

export default defineConfig({
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  // Ship the agent skill with the package so `docker-doctor install` and the
  // post-scan handoff can copy it into agents' skills dirs.
  copy: [{ from: "../../skills/docker-doctor", to: "skill" }],
  deps: {
    alwaysBundle: ["@docker-doctor/core", "chalk"],
  },
  dts: {
    eager: true,
    generator: "oxc",
  },
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  minify: false,
  shims: true,
  sourcemap: true,
  target: "es2022",
});
