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
    ["/dev", "system"],
    ["/dev/", "system"],
    ["/var", "system"],
    ["/var/", "system"],
    ["/var/lib/docker", "system"],
    ["/var/lib/docker/", "system"],
    ["/var/lib/docker/volumes", "system"],
    ["/var/run", "system"],
    ["/dev/dri", "host"],
    ["/dev/shm", "host"],
    ["/var/www", "host"],
    ["/var/log/app", "host"],
    ["/var/lib/app", "host"],
    ["/var/lib/docker-data", "host"],
  ];

  test.each(cases)("%s is %s", (hostPath, scope) => {
    expect(classifyHostPath(hostPath)).toBe(scope);
  });
});
