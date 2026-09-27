import { describe, expect, test } from "bun:test";
import path from "node:path";

// The published library entry. Type-only exports do not exist at runtime, so
// this list is every value consumers can import from the package.
const DOCUMENTED_EXPORTS = [
  "allRules",
  "calculateScore",
  "defineConfig",
  "discoverProject",
  "findRule",
  "loadConfig",
  "parseCompose",
  "parseDockerfile",
  "runComposeRules",
  "runDockerfileRules",
  "toJsonReport",
  "version",
];

const ENTRY = path.join(import.meta.dir, "..", "dist", "index.mjs");

describe("library entry", () => {
  test("dist/index.mjs exposes exactly the documented runtime exports", async () => {
    const mod = await import(ENTRY);
    expect(Object.keys(mod).toSorted()).toEqual(DOCUMENTED_EXPORTS);
    expect(mod.version).toMatch(/^\d+\.\d+\.\d+/u);
    expect(mod.allRules.length).toBeGreaterThan(0);
  });
});
