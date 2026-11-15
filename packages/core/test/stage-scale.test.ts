import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { avoidDevDependencies, preferSlimBase } from "../src/rules/image-size";
import { pinImageVersion } from "../src/rules/security";

const STAGE_COUNT = 5000;

// The old per-FROM rescans took several seconds here. The bound is loose
// because CI runners are 5 to 10 times slower than a developer machine.
const WHOLE_FILE_BOUND_MS = 1000;

// Each stage builds FROM the one before it, so every FROM names an earlier
// stage and the last stage ships the whole chain.
const chainedStages = (base: string): string => {
  const lines = [`FROM ${base} AS s0`, "RUN npm ci"];

  for (let index = 1; index < STAGE_COUNT; index += 1) {
    lines.push(`FROM s${index - 1} AS s${index}`, "RUN npm ci");
  }

  return `${lines.join("\n")}\n`;
};

const timed = <T>(run: () => T) => {
  const start = performance.now();
  const value = run();

  return { ms: performance.now() - start, value };
};

describe("stage-aware rules on a Dockerfile with many stages", () => {
  const untagged = parseDockerfile(chainedStages("node"), "Dockerfile");
  const instructions = parseDockerfile(chainedStages("node:22"), "Dockerfile");

  test("pin-image-version finds the one untagged base in linear time", () => {
    const { ms, value } = timed(() =>
      pinImageVersion.check(untagged, "Dockerfile")
    );

    expect(value).toHaveLength(1);
    expect(value[0].line).toBe(1);
    expect(ms).toBeLessThan(WHOLE_FILE_BOUND_MS);
  });

  test("prefer-slim-base follows the shipped chain in linear time", () => {
    const { ms, value } = timed(() =>
      preferSlimBase.check(instructions, "Dockerfile")
    );

    expect(value).toHaveLength(1);
    expect(value[0].line).toBe(1);
    expect(ms).toBeLessThan(WHOLE_FILE_BOUND_MS);
  });

  test("avoid-dev-dependencies reports every stage of the shipped chain", () => {
    const diagnostics = avoidDevDependencies.check(instructions, "Dockerfile");

    expect(diagnostics).toHaveLength(STAGE_COUNT);
  });
});
