import { describe, expect, test } from "bun:test";

import { createIgnoreMatcher } from "../src/project-info/ignore";

// Recorded from the matcher before adjacent `**/` segments were collapsed.
// Each pattern lists the paths below it must match, so a change to what a
// pattern means shows up here.
const PATHS = [
  "",
  "x",
  "q",
  "a/q",
  "a/b/q",
  "a/b/c/d/q",
  "x/y/z",
  "x/y/q",
  "a/x/y/z",
  "a/b/c/x/y/z",
  "x/x/y/z",
  "a/x/y/z/w",
  "Dockerfile",
  "a/Dockerfile",
  "a/b/Dockerfile",
  "examples/Dockerfile",
  "examples/a/b/Dockerfile",
  "vendor",
  "vendor/a",
  "docs/readme.md",
  "README.md",
  "a/b/README.md",
  "node_modules/x",
  "a/node_modules/x/y",
  "node_modules/a/x",
  "a/node_modules/b/c/x",
  "a/test/b",
  "test",
  "b.generated.ts",
  "a/b.generated.ts",
  "services/a/compose.yml",
  "services/ab/compose.yml",
  "api.dockerfile",
  "nested/api.dockerfile",
  "a/b",
  "a/a/b",
  "a/b/b",
  "a//b",
  "a/",
  "x/y",
] as const;

const PATTERN_MATCHES = [
  {
    matches: [
      "node_modules/x",
      "a/node_modules/x/y",
      "node_modules/a/x",
      "a/node_modules/b/c/x",
    ],
    pattern: "**/node_modules/**",
  },
  { matches: ["vendor/a"], pattern: "vendor/**" },
  { matches: ["docs/readme.md"], pattern: "docs/**" },
  {
    matches: ["docs/readme.md", "README.md", "a/b/README.md"],
    pattern: "**/*.md",
  },
  { matches: ["examples/Dockerfile"], pattern: "examples/*" },
  { matches: ["a/test/b"], pattern: "**/test/**" },
  {
    matches: ["b.generated.ts", "a/b.generated.ts"],
    pattern: "**/*.generated.*",
  },
  {
    matches: ["examples/Dockerfile", "examples/a/b/Dockerfile"],
    pattern: "examples/**/Dockerfile",
  },
  { matches: ["api.dockerfile"], pattern: "*.dockerfile" },
  { matches: ["services/a/compose.yml"], pattern: "services/?/compose.yml" },
  { matches: ["Dockerfile"], pattern: "Dockerfile" },
  { matches: ["vendor/a"], pattern: "./vendor/" },
  { matches: ["vendor/a"], pattern: "vendor/" },
  {
    matches: [
      "",
      "x",
      "q",
      "a/q",
      "a/b/q",
      "a/b/c/d/q",
      "x/y/z",
      "x/y/q",
      "a/x/y/z",
      "a/b/c/x/y/z",
      "x/x/y/z",
      "a/x/y/z/w",
      "Dockerfile",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "examples/Dockerfile",
      "examples/a/b/Dockerfile",
      "vendor",
      "vendor/a",
      "docs/readme.md",
      "README.md",
      "a/b/README.md",
      "node_modules/x",
      "a/node_modules/x/y",
      "node_modules/a/x",
      "a/node_modules/b/c/x",
      "a/test/b",
      "test",
      "b.generated.ts",
      "a/b.generated.ts",
      "services/a/compose.yml",
      "services/ab/compose.yml",
      "api.dockerfile",
      "nested/api.dockerfile",
      "a/b",
      "a/a/b",
      "a/b/b",
      "a//b",
      "a/",
      "x/y",
    ],
    pattern: "**",
  },
  {
    matches: [
      "",
      "x",
      "q",
      "a/q",
      "a/b/q",
      "a/b/c/d/q",
      "x/y/z",
      "x/y/q",
      "a/x/y/z",
      "a/b/c/x/y/z",
      "x/x/y/z",
      "a/x/y/z/w",
      "Dockerfile",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "examples/Dockerfile",
      "examples/a/b/Dockerfile",
      "vendor",
      "vendor/a",
      "docs/readme.md",
      "README.md",
      "a/b/README.md",
      "node_modules/x",
      "a/node_modules/x/y",
      "node_modules/a/x",
      "a/node_modules/b/c/x",
      "a/test/b",
      "test",
      "b.generated.ts",
      "a/b.generated.ts",
      "services/a/compose.yml",
      "services/ab/compose.yml",
      "api.dockerfile",
      "nested/api.dockerfile",
      "a/b",
      "a/a/b",
      "a/b/b",
      "a//b",
      "a/",
      "x/y",
    ],
    pattern: "**/",
  },
  {
    matches: [
      "Dockerfile",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "examples/Dockerfile",
      "examples/a/b/Dockerfile",
    ],
    pattern: "**/Dockerfile",
  },
  { matches: ["a/test/b", "a/b", "a/a/b", "a/b/b", "a//b"], pattern: "a/**/b" },
  {
    matches: [
      "x",
      "node_modules/x",
      "node_modules/a/x",
      "a/node_modules/b/c/x",
    ],
    pattern: "**/**/x",
  },
  {
    matches: ["x/y/z", "a/x/y/z", "a/b/c/x/y/z", "x/x/y/z"],
    pattern: "**/**/**/x/y/z",
  },
  {
    matches: ["x/y/z", "a/x/y/z", "a/b/c/x/y/z", "x/x/y/z"],
    pattern: "**/**/**/**/**/**/x/y/z",
  },
  {
    matches: ["q", "a/q", "a/b/q", "a/b/c/d/q", "x/y/q"],
    pattern: "**/**/**/**/**/**/**/**/q",
  },
  {
    matches: ["docs/readme.md", "README.md", "a/b/README.md"],
    pattern: "**/**/*.md",
  },
  {
    matches: ["a/test/b", "a/b", "a/a/b", "a/b/b", "a//b"],
    pattern: "a/**/**/b",
  },
  {
    matches: [
      "",
      "x",
      "q",
      "a/q",
      "a/b/q",
      "a/b/c/d/q",
      "x/y/z",
      "x/y/q",
      "a/x/y/z",
      "a/b/c/x/y/z",
      "x/x/y/z",
      "a/x/y/z/w",
      "Dockerfile",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "examples/Dockerfile",
      "examples/a/b/Dockerfile",
      "vendor",
      "vendor/a",
      "docs/readme.md",
      "README.md",
      "a/b/README.md",
      "node_modules/x",
      "a/node_modules/x/y",
      "node_modules/a/x",
      "a/node_modules/b/c/x",
      "a/test/b",
      "test",
      "b.generated.ts",
      "a/b.generated.ts",
      "services/a/compose.yml",
      "services/ab/compose.yml",
      "api.dockerfile",
      "nested/api.dockerfile",
      "a/b",
      "a/a/b",
      "a/b/b",
      "a//b",
      "a/",
      "x/y",
    ],
    pattern: "**/**/**",
  },
  {
    matches: [
      "a/q",
      "a/b/q",
      "a/b/c/d/q",
      "a/x/y/z",
      "a/b/c/x/y/z",
      "a/x/y/z/w",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "a/b/README.md",
      "a/node_modules/x/y",
      "a/node_modules/b/c/x",
      "a/test/b",
      "a/b.generated.ts",
      "a/b",
      "a/a/b",
      "a/b/b",
      "a//b",
      "a/",
    ],
    pattern: "a/**/**/**/",
  },
  {
    matches: ["node_modules/x", "node_modules/a/x", "a/node_modules/b/c/x"],
    pattern: "**/***/x",
  },
  { matches: ["x/y"], pattern: "x/**/**/**/**/y" },
  {
    matches: [
      "Dockerfile",
      "a/Dockerfile",
      "a/b/Dockerfile",
      "examples/Dockerfile",
      "examples/a/b/Dockerfile",
    ],
    pattern: "./**/**/Dockerfile",
  },
  {
    matches: ["node_modules/x", "node_modules/a/x", "a/node_modules/b/c/x"],
    pattern: "**/**/node_modules/**/**/x",
  },
] as const;

describe("createIgnoreMatcher", () => {
  test.each(PATTERN_MATCHES)(
    "$pattern matches the same paths as before",
    ({ pattern, matches }) => {
      const isIgnored = createIgnoreMatcher([pattern]);

      expect(PATHS.filter((path) => isIgnored(path))).toEqual([...matches]);
    }
  );

  // One regex over a 20,000 character path. The old stacked groups took about
  // 470 ms here and the collapsed group takes under 1 ms. The bound is loose
  // because CI runners are 5 to 10 times slower than a developer machine.
  test("repeated **/ segments match a long path without stalling", () => {
    const isIgnored = createIgnoreMatcher(["**/**/**/**/**/**/x/y/z"]);
    const path = `${"a/".repeat(10_000)}x/y/q`;

    const start = performance.now();
    const ignored = isIgnored(path);

    expect(performance.now() - start).toBeLessThan(50);
    expect(ignored).toBe(false);
  });

  test("repeated **/ segments still match a long path they cover", () => {
    const isIgnored = createIgnoreMatcher(["**/**/**/**/**/**/x/y/z"]);

    expect(isIgnored(`${"a/".repeat(100_000)}x/y/z`)).toBe(true);
  });
});
