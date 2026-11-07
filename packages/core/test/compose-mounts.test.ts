import { describe, expect, test } from "bun:test";

import { parseComposeImage } from "../src/rules/compose-images";
import type { HostPathScope } from "../src/rules/compose-mounts";
import {
  applyFoldsAndDefaults,
  classifyHostPath,
  resolveInterpolationDefaults,
} from "../src/rules/compose-mounts";
import { socketProxyRisk } from "../src/rules/compose-socket-proxy";

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
    ["/var/lib", "system"],
    ["/var/lib/containerd", "system"],
    ["/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs", "system"],
    ["/var/lib/docker", "system"],
    ["/var/lib/docker/", "system"],
    ["/var/lib/docker/volumes", "system"],
    ["/var/run", "system"],
    ["/dev/dri", "host"],
    ["/dev/shm", "host"],
    ["/var/www", "host"],
    ["/var/log/app", "host"],
    ["/var/lib/app", "host"],
    ["/var/lib/app", "host"],
    ["/var/lib/docker-data", "host"],
  ];

  test.each(cases)("%s is %s", (hostPath, scope) => {
    expect(classifyHostPath(hostPath)).toBe(scope);
  });
});

describe("applyFoldsAndDefaults", () => {
  const folded = [
    { input: `\${A:-x}`, output: "x" },
    { input: `\${A-x}/\${B:-y}`, output: "x/y" },
    { input: `/srv/\${A:-$HOME/data}`, output: "/srv/~/data" },
    { input: `\${A:-$B}`, output: "$B" },
    { input: `\${HOME}/\${PWD}/\${A:-}`, output: "~/./" },
    { input: `\${A:-x`, output: `\${A:-x` },
    { input: `\${A:-\${B`, output: `\${A:-\${B` },
    { input: `\${A}`, output: `\${A}` },
  ];

  test.each(folded)("reads $input as $output", ({ input, output }) => {
    expect(applyFoldsAndDefaults(input)).toBe(output);
  });

  test("resolveInterpolationDefaults drops what has no default", () => {
    expect(resolveInterpolationDefaults(`\${A:-x}/\${B}/$C`)).toBe("x//");
    expect(resolveInterpolationDefaults(`\${A:-x`)).toBe(`\${A:-x`);
    expect(resolveInterpolationDefaults(`\${A:-\${B:-c}}`)).toBe("");
  });
});

// A value from a scanned file can be built to make a pattern rescan to its end
// from every start, so 200,000 characters must stay fast.
const ADVERSARIAL_LENGTH = 200_000;
const TIME_LIMIT_MS = 50;

const unclosedInterpolations = [
  { name: "unclosed defaults", text: "${A:-".repeat(ADVERSARIAL_LENGTH / 5) },
  { name: "dollar braces", text: "${".repeat(ADVERSARIAL_LENGTH / 2) },
  { name: "unclosed names", text: "${A".repeat(ADVERSARIAL_LENGTH / 3) },
  {
    name: "unclosed defaults after a brace",
    text: `}${"${A:-".repeat(ADVERSARIAL_LENGTH / 5)}`,
  },
  {
    name: "defaults that end in a dollar",
    text: "${A:-$".repeat(ADVERSARIAL_LENGTH / 6),
  },
];

const msSince = (start: number): number => performance.now() - start;

describe("Compose interpolation on a long value", () => {
  test.each(unclosedInterpolations)(
    "applyFoldsAndDefaults finishes 200,000 characters of $name within 50 ms",
    ({ text }) => {
      const start = performance.now();
      applyFoldsAndDefaults(text);
      expect(msSince(start)).toBeLessThan(TIME_LIMIT_MS);
    }
  );

  test.each(unclosedInterpolations)(
    "resolveInterpolationDefaults finishes 200,000 characters of $name within 50 ms",
    ({ text }) => {
      const start = performance.now();
      resolveInterpolationDefaults(text);
      expect(msSince(start)).toBeLessThan(TIME_LIMIT_MS);
    }
  );

  test.each(unclosedInterpolations)(
    "socketProxyRisk finishes a POST value of 200,000 characters of $name within 50 ms",
    ({ text }) => {
      const service = {
        environment: { CONTAINERS: 1, POST: text },
        image: "tecnativa/docker-socket-proxy:0.3.0",
      };

      const start = performance.now();
      socketProxyRisk(service);
      expect(msSince(start)).toBeLessThan(TIME_LIMIT_MS);
    }
  );

  test.each(unclosedInterpolations)(
    "parseComposeImage finishes an image of 200,000 characters of $name within 50 ms",
    ({ text }) => {
      const start = performance.now();
      parseComposeImage(text);
      expect(msSince(start)).toBeLessThan(TIME_LIMIT_MS);
    }
  );
});
