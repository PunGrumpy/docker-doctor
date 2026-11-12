import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { avoidDevDependencies } from "../src/rules/image-size";

const check = (source: string) =>
  avoidDevDependencies.check(parseDockerfile(source), "Dockerfile");

describe("avoidDevDependencies NODE_ENV in ENV", () => {
  test("NODE_ENV=production text inside another variable's value is not NODE_ENV", () => {
    expect(
      check(`FROM node:22\nENV FOO="a NODE_ENV=production"\nRUN npm ci\n`)
    ).toHaveLength(1);
  });

  test("ENV NODE_ENV=production silences the diagnostic", () => {
    expect(
      check(`FROM node:22\nENV NODE_ENV=production\nRUN npm ci\n`)
    ).toHaveLength(0);
  });

  test("legacy ENV NODE_ENV production silences the diagnostic", () => {
    expect(
      check(`FROM node:22\nENV NODE_ENV production\nRUN npm ci\n`)
    ).toHaveLength(0);
  });

  test("NODE_ENV in a multi-variable ENV still counts", () => {
    expect(
      check(`FROM node:22\nENV FOO=bar NODE_ENV="production"\nRUN npm ci\n`)
    ).toHaveLength(0);
  });
});
