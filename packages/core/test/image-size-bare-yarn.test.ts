import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { avoidDevDependencies } from "../src/rules/image-size";

const run = (command: string) =>
  avoidDevDependencies.check(
    parseDockerfile(`FROM node:22-slim\nCOPY . .\nRUN ${command}\n`),
    "Dockerfile"
  );

describe("avoidDevDependencies bare yarn", () => {
  test.each([
    "yarn",
    "yarn --frozen-lockfile",
    "yarn --immutable",
    "NODE_ENV=development yarn",
  ])("`%s` is Yarn's default install and is flagged", (command) => {
    expect(run(command)).toHaveLength(1);
  });

  test.each([
    "NODE_ENV=production yarn",
    "yarn --production",
    "yarn --production --frozen-lockfile",
    "yarn --version",
    "yarn -v",
    "yarn --help",
    "yarn --cwd app",
    "yarn build",
    "yarn run build",
  ])("`%s` is not flagged", (command) => {
    expect(run(command)).toHaveLength(0);
  });
});
