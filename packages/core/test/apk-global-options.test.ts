import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/index";
import { cleanPackageCache } from "../src/rules/image-size";

const run = (line: string) =>
  cleanPackageCache.check(
    parseDockerfile(`FROM alpine\n${line}\n`),
    "Dockerfile"
  );

describe("apk add with global options before add", () => {
  test("flags apk --update add without --no-cache", () => {
    expect(run("RUN apk --update add curl")).toHaveLength(1);
  });

  test("flags apk -U add without --no-cache", () => {
    expect(run("RUN apk -U add curl")).toHaveLength(1);
  });

  test("accepts a global --no-cache before add", () => {
    expect(run("RUN apk --no-cache add curl")).toHaveLength(0);
    expect(run("RUN apk --update --no-cache add curl")).toHaveLength(0);
  });

  test("accepts --no-cache after add", () => {
    expect(run("RUN apk --update add --no-cache curl")).toHaveLength(0);
  });

  test("still flags plain apk add and accepts the plain fixed form", () => {
    expect(run("RUN apk add curl")).toHaveLength(1);
    expect(run("RUN apk add --no-cache curl")).toHaveLength(0);
  });

  test("ignores a --no-cache that belongs to a later command", () => {
    expect(
      run("RUN apk --update add curl && pip install --no-cache x")
    ).toHaveLength(1);
  });
});
