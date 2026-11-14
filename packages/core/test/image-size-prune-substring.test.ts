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
    "npm ci && NODE_ENV=production npm prune",
    "pnpm install --frozen-lockfile && pnpm prune --prod",
    "npm ci; npm prune --omit=dev",
    "npm prune --omit=dev && npm ci",
  ])("`%s` is silent because a real prune runs", (run) => {
    expect(check(`FROM node:22\nRUN ${run}\n`)).toHaveLength(0);
  });
});
