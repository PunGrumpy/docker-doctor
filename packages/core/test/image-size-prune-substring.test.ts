import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { avoidDevDependencies } from "../src/rules/image-size";

const check = (source: string) =>
  avoidDevDependencies.check(parseDockerfile(source), "Dockerfile");

describe("avoidDevDependencies prune detection", () => {
  test.each([
    "npm ci && node scripts/prune-cache.js",
    "npm ci && echo prune",
    "npm ci && docker system prune -f",
    "npm ci && git remote prune origin",
    "npm ci && ./build.sh --prune",
  ])("`%s` still flags the install", (run) => {
    expect(check(`FROM node:22\nRUN ${run}\n`)).toHaveLength(1);
  });

  test.each([
    "npm ci && npm prune --omit=dev",
    "npm ci && npm prune --production",
    "npm ci && npm prune --omit dev",
    "npm ci && npm --silent prune --omit=dev",
    "npm ci && NODE_ENV=production npm prune",
    "export NODE_ENV=production && npm ci --include=dev && npm prune",
    "pnpm install --frozen-lockfile && pnpm prune --prod",
    "npm ci; npm prune --omit=dev",
  ])("`%s` is silent because a real prune removes dev dependencies", (run) => {
    expect(check(`FROM node:22\nRUN ${run}\n`)).toHaveLength(0);
  });

  test.each([
    "npm ci && npm prune",
    "npm ci && npm prune --dry-run --omit=dev",
    "npm ci && npm prune --omit=optional",
    "pnpm install && pnpm prune",
    "npm prune --omit=dev && npm ci",
    "npm ci && npm prune --omit=dev && npm ci",
  ])("`%s` still flags the install", (run) => {
    expect(check(`FROM node:22\nRUN ${run}\n`)).toHaveLength(1);
  });

  test("NODE_ENV=production from the stage ENV makes a bare npm prune count", () => {
    expect(
      check(
        "FROM node:22\nENV NODE_ENV=production\nRUN npm ci --include=dev && npm prune\n"
      )
    ).toHaveLength(0);
  });
});
