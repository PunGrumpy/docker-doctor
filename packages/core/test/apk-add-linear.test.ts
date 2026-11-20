import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/index";
import { cleanPackageCache } from "../src/rules/image-size";

const run = (line: string) =>
  cleanPackageCache.check(
    parseDockerfile(`FROM alpine\n${line}\n`),
    "Dockerfile"
  );

describe("apk add --no-cache matching", () => {
  test("reports apk add without --no-cache", () => {
    expect(run("RUN apk add curl")).toHaveLength(1);
  });

  test("accepts --no-cache before or after add, and after the packages", () => {
    expect(run("RUN apk add --no-cache curl")).toHaveLength(0);
    expect(run("RUN apk --no-cache add curl")).toHaveLength(0);
    expect(run("RUN apk add curl --no-cache")).toHaveLength(0);
  });

  test("does not count an option that belongs to another command", () => {
    expect(
      run("RUN apk add curl && pip install --no-cache-dir x")
    ).toHaveLength(1);
    expect(run("RUN pip install --no-cache x && apk add curl")).toHaveLength(1);
  });

  test("accepts a line where any command is an apk add with --no-cache", () => {
    expect(run("RUN apk add a; apk add --no-cache b")).toHaveLength(0);
    expect(run("RUN apk add --no-cache a; apk add b")).toHaveLength(0);
  });

  test("checks a 400,000 character line of repeated apk add in linear time", () => {
    const line = `RUN ${"apk add ".repeat(50_000)}`;

    const start = performance.now();
    const diagnostics = run(line);
    const elapsed = performance.now() - start;

    expect(diagnostics).toHaveLength(1);
    // The quadratic version took 8 s. The bound is loose because CI
    // runners are several times slower than a developer machine.
    expect(elapsed).toBeLessThan(1000);
  });

  test("checks a 400,000 character line of repeated apk options in linear time", () => {
    const line = `RUN apk ${"--x ".repeat(50_000)}${"apk --y ".repeat(25_000)}add`;

    const start = performance.now();
    const diagnostics = run(line);
    const elapsed = performance.now() - start;

    expect(diagnostics).toHaveLength(1);
    expect(elapsed).toBeLessThan(1000);
  });
});
