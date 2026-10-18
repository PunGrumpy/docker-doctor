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
  "isAnalyzableCompose",
  "isAnalyzableDockerfile",
  "loadConfig",
  "parseCompose",
  "parseDockerfile",
  "runComposeRules",
  "runDockerfileRules",
  "toJsonReport",
  "version",
];

const ENTRY = path.join(import.meta.dir, "..", "dist", "index.mjs");

const isObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null;

describe("library entry", () => {
  test("dist/index.mjs exposes exactly the documented runtime exports", async () => {
    const mod: unknown = await import(ENTRY);

    if (!isObject(mod)) {
      throw new Error("dist/index.mjs did not load as a module");
    }

    expect(Object.keys(mod).toSorted()).toEqual(DOCUMENTED_EXPORTS);
    expect(mod).toHaveProperty(
      "version",
      expect.stringMatching(/^\d+\.\d+\.\d+/u)
    );
    expect(mod).toHaveProperty(
      "allRules",
      expect.arrayContaining([expect.anything()])
    );
  });
});
