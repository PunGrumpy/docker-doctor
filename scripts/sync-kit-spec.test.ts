import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { syncKitDescriptor } from "./sync-kit-spec";

const ROOT = path.join(import.meta.dir, "..");
const DESCRIPTOR = path.join(ROOT, "kits/docker-doctor/docker-doctor.yaml");

const changedLines = (before: string, after: string): string[] => {
  const old = before.split("\n");

  return after.split("\n").filter((line, index) => line !== old[index]);
};

describe("syncKitDescriptor", () => {
  test("rewrites only the kit version and the CLI pin in the real descriptor", () => {
    const before = fs.readFileSync(DESCRIPTOR, "utf-8");

    const after = syncKitDescriptor(before, {
      cliVersion: "8.8.8",
      kitVersion: "9.9.9",
    });

    expect(changedLines(before, after)).toEqual([
      'version: "9.9.9"',
      '    default: "8.8.8"',
    ]);
  });

  test("refuses a v2 spec.yaml, which has no cliVersion arg", () => {
    const v2 = [
      'schemaVersion: "2"',
      'version: "0.1.14"',
      "        npm install -g @docker-doctor/cli@0.9.1",
      "",
    ].join("\n");

    expect(() =>
      syncKitDescriptor(v2, { cliVersion: "0.9.1", kitVersion: "0.1.14" })
    ).toThrow("cliVersion");
  });

  test("refuses a descriptor whose version is not a quoted literal", () => {
    const unquoted = [
      "version: 0.1.14",
      "args:",
      "  cliVersion:",
      '    default: "0.9.1"',
      "",
    ].join("\n");

    expect(() =>
      syncKitDescriptor(unquoted, { cliVersion: "0.9.1", kitVersion: "0.1.14" })
    ).toThrow("version");
  });
});

test("the committed kit descriptor matches kits/docker-doctor/package.json", () => {
  const result = Bun.spawnSync(
    ["bun", path.join(ROOT, "scripts/sync-kit-spec.ts"), "--check"],
    { cwd: ROOT }
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
