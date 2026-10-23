import { describe, expect, test } from "bun:test";

import type { HostPathScope } from "../src/rules/compose-mounts";
import { classifyHostPath } from "../src/rules/compose-mounts";

describe("classifyHostPath", () => {
  const cases: [string, HostPathScope][] = [
    [".", "project"],
    ["./", "project"],
    [".//", "project"],
    ["./src", "project"],
    ["src/data", "project"],
    ["./../shared", "parent"],
    ["../shared", "parent"],
  ];

  test.each(cases)("%s is %s", (hostPath, scope) => {
    expect(classifyHostPath(hostPath)).toBe(scope);
  });
});
