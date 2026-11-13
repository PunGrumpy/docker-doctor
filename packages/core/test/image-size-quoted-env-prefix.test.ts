import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { avoidDevDependencies } from "../src/rules/image-size";

const check = (source: string) =>
  avoidDevDependencies.check(parseDockerfile(source), "Dockerfile");

describe("avoidDevDependencies quoted env prefix", () => {
  test("a quoted NODE_ENV=development prefix still flags npm ci", () => {
    expect(
      check(`FROM node:20\nRUN NODE_ENV="development" npm ci\n`)
    ).toHaveLength(1);
  });

  test("a quoted prefix value with a space still flags npm ci", () => {
    expect(check(`FROM node:20\nRUN FOO="a b" npm ci\n`)).toHaveLength(1);
  });

  test("a single-quoted prefix still flags npm ci", () => {
    expect(check(`FROM node:20\nRUN FOO='a b' npm ci\n`)).toHaveLength(1);
  });

  test("a quoted NODE_ENV=production prefix silences the diagnostic", () => {
    expect(
      check(`FROM node:20\nRUN NODE_ENV="production" yarn install\n`)
    ).toHaveLength(0);
  });

  test("a quoted export of NODE_ENV=production reaches a later install", () => {
    expect(
      check(`FROM node:20\nRUN export NODE_ENV="production" && yarn install\n`)
    ).toHaveLength(0);
  });
});
