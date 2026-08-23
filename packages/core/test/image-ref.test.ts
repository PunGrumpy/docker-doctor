import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  collectStageAliases,
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

describe("collectStageAliases", () => {
  test("collects an alias from a two-stage build", () => {
    const instructions = parseDockerfile(`
      FROM node:22-alpine AS build
      FROM build
    `);
    expect(collectStageAliases(instructions)).toEqual(new Set(["build"]));
  });

  test("returns an empty set when no AS clause is present", () => {
    const instructions = parseDockerfile(`
      FROM node:22-alpine
    `);
    expect(collectStageAliases(instructions)).toEqual(new Set());
  });

  test("collects a lowercase as clause", () => {
    const instructions = parseDockerfile(`
      FROM node:22-alpine as build
      FROM build
    `);
    expect(collectStageAliases(instructions)).toEqual(new Set(["build"]));
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
});
