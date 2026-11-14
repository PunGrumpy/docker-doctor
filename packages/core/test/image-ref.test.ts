import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  createStageLookup,
  isScratch,
  parseFromArgs,
  parseImageRef,
} from "../src/parsers/image-ref";

describe("parseImageRef", () => {
  test("bare image name", () => {
    const ref = parseImageRef("node");
    expect(ref.name).toBe("node");
    expect(ref.tag).toBeUndefined();
    expect(ref.digest).toBeUndefined();
  });

  test("image with a version tag", () => {
    const ref = parseImageRef("node:22.2.0-alpine");
    expect(ref.tag).toBe("22.2.0-alpine");
  });

  test("image with the latest tag", () => {
    const ref = parseImageRef("node:latest");
    expect(ref.tag).toBe("latest");
  });

  test("any $ marks the reference as a variable", () => {
    for (const ref of [
      `node:\${NODE_VERSION}`,
      "node:$NODE_VERSION",
      "$REGISTRY/app:1.0",
      "myregistry.example.com/$IMAGE",
    ]) {
      expect(parseImageRef(ref).isVariable).toBe(true);
    }

    expect(parseImageRef("node:22").isVariable).toBe(false);
  });

  test("registry with a port and no tag", () => {
    const ref = parseImageRef("myregistry.example.com:5000/team/app");
    expect(ref.registry).toBe("myregistry.example.com:5000");
    expect(ref.name).toContain("team/app");
    expect(ref.tag).toBeUndefined();
  });

  test("registry with a port and a tag", () => {
    const ref = parseImageRef("myregistry.example.com:5000/team/app:1.2.3");
    expect(ref.registry).toBe("myregistry.example.com:5000");
    expect(ref.tag).toBe("1.2.3");
  });

  test("digest without a tag", () => {
    const ref = parseImageRef("node@sha256:aaaa");
    expect(ref.digest).toBe("sha256:aaaa");
    expect(ref.tag).toBeUndefined();
  });

  test("tag and digest together", () => {
    const ref = parseImageRef("node:22@sha256:aaaa");
    expect(ref.tag).toBe("22");
    expect(ref.digest).toBe("sha256:aaaa");
  });

  test("variable-driven image", () => {
    const ref = parseImageRef(`\${NODE_IMAGE}`);
    expect(ref.isVariable).toBe(true);
  });

  test("localhost registry", () => {
    const ref = parseImageRef("localhost:5000/app");
    expect(ref.registry).toBe("localhost:5000");
    expect(ref.tag).toBeUndefined();
  });
});

describe("createStageLookup", () => {
  test("finds a stage declared on an earlier line", () => {
    const isEarlierStage = createStageLookup(
      parseDockerfile(`
      FROM node:22-alpine AS build
      FROM build
    `)
    );

    expect(isEarlierStage("build", 3)).toBe(true);
  });

  test("knows no stage when no FROM has an AS clause", () => {
    const isEarlierStage = createStageLookup(
      parseDockerfile(`
      FROM node:22-alpine
    `)
    );

    expect(isEarlierStage("node", Number.POSITIVE_INFINITY)).toBe(false);
  });

  test("sees only the stages declared before a line", () => {
    const isEarlierStage = createStageLookup(
      parseDockerfile(
        "FROM node:22-alpine AS build\nFROM golang AS golang\nFROM build AS final"
      )
    );

    expect(isEarlierStage("build", 2)).toBe(true);
    expect(isEarlierStage("golang", 2)).toBe(false);
    expect(isEarlierStage("golang", 3)).toBe(true);
    expect(isEarlierStage("final", 3)).toBe(false);
  });

  test("keeps the first declaration of a repeated name", () => {
    const isEarlierStage = createStageLookup(
      parseDockerfile("FROM a AS x\nFROM b AS x\nFROM c")
    );

    expect(isEarlierStage("x", 2)).toBe(true);
    expect(isEarlierStage("x", 1)).toBe(false);
  });

  test("matches names without regard to case", () => {
    const isEarlierStage = createStageLookup(
      parseDockerfile(`
      FROM node:22-alpine as Build
      FROM build
    `)
    );

    expect(isEarlierStage("BUILD", 3)).toBe(true);
    expect(isEarlierStage("build", 3)).toBe(true);
  });
});

describe("parseFromArgs", () => {
  test("splits base and stage from FROM args", () => {
    expect(parseFromArgs("debian:12-slim")).toEqual({
      base: "debian:12-slim",
      stage: null,
    });
    expect(parseFromArgs("--platform=linux/amd64 node:20 AS build")).toEqual({
      base: "node:20",
      stage: "build",
    });
    expect(parseFromArgs("base as final")).toEqual({
      base: "base",
      stage: "final",
    });
    expect(parseFromArgs("")).toEqual({ base: null, stage: null });
  });

  test("finds the stage when a flag follows the base", () => {
    expect(parseFromArgs("base --platform=linux/amd64 AS app")).toEqual({
      base: "base",
      stage: "app",
    });
  });
});

describe("isScratch", () => {
  test("matches the reserved empty base in any case", () => {
    expect(isScratch("scratch")).toBe(true);
    expect(isScratch("SCRATCH")).toBe(true);
    expect(isScratch("Scratch")).toBe(true);
  });

  test("does not match real images or a missing base", () => {
    expect(isScratch("node:22-alpine")).toBe(false);
    expect(isScratch("scratchpad")).toBe(false);
    expect(isScratch(null)).toBe(false);
  });
});
