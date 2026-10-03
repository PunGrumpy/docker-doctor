import { describe, expect, test } from "bun:test";

import { stripRunFlags } from "../src/parsers/run-flags";

describe("stripRunFlags", () => {
  const cases = [
    { args: "npm ci", expected: "npm ci" },
    {
      args: "--mount=type=cache,target=/root/.npm npm ci",
      expected: "npm ci",
    },
    {
      args: "--mount=type=cache,target=/a --mount=type=secret,id=npm --network=none make all",
      expected: "make all",
    },
    { args: "--security=insecure cd /app && ls", expected: "cd /app && ls" },
    // Only leading options are RUN flags. A later one belongs to the command.
    {
      args: "curl --fail https://example.com",
      expected: "curl --fail https://example.com",
    },
    // A flag with no command after it is left alone.
    {
      args: "--mount=type=secret,id=token",
      expected: "--mount=type=secret,id=token",
    },
  ];

  test.each(cases)("$args", ({ args, expected }) => {
    expect(stripRunFlags(args)).toBe(expected);
  });
});
