import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadConfig } from "../src/config/loader";
import { ConfigError } from "../src/errors";
import type { DockerDoctorConfig } from "../src/schemas/config";

// The `DockerDoctorConfig["categories"]` type is a full `Record<RuleCategory,
// RuleSeverity>` (all 5 keys), but a valid runtime config may legitimately
// set only a subset. `as unknown as DockerDoctorConfig` below silences that
// pre-existing type-vs-runtime mismatch without altering what is actually
// compared at runtime (still a plain deep-equal on the literal object).
const expectPartialCategories = (value: unknown): DockerDoctorConfig =>
  value as unknown as DockerDoctorConfig;

describe("loadConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "docker-doctor-config-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { force: true, recursive: true });
  });

  test("returns {} when no config file exists", async () => {
    const config = await loadConfig(dir);
    expect(config).toEqual({});
  });

  test("returns valid rules as-is", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "no-latest-tag": "error" } })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ rules: { "no-latest-tag": "error" } });
  });

  test("returns valid categories as-is", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ categories: { Security: "warning" } })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual(
      expectPartialCategories({ categories: { Security: "warning" } })
    );
  });

  test("returns valid ignore.files as-is", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ ignore: { files: ["Dockerfile.test"] } })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ ignore: { files: ["Dockerfile.test"] } });
  });

  test("throws ConfigError on invalid severity value", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "no-latest-tag": "banana" } })
    );
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
  });

  test("throws ConfigError with correct _tag on invalid severity value", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "no-latest-tag": "banana" } })
    );
    try {
      await loadConfig(dir);
      expect.unreachable("loadConfig should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError)._tag).toBe("ConfigError");
    }
  });

  test("throws ConfigError when rules is the wrong type", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: "not-an-object" })
    );
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
  });

  test("prefers .ts config over .json when both exist", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "from-json": "error" } })
    );
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.ts"),
      'export default { rules: { "from-ts": "warning" } };\n'
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ rules: { "from-ts": "warning" } });
  });

  test("falls back to package.json#dockerDoctor when no config file exists", async () => {
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        dockerDoctor: { rules: { "from-pkg": "info" } },
        name: "fixture",
      })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ rules: { "from-pkg": "info" } });
  });

  test("does not throw on malformed package.json, returns {}", async () => {
    await fs.writeFile(path.join(dir, "package.json"), "{ this is not json");
    const config = await loadConfig(dir);
    expect(config).toEqual({});
  });

  // Pins the CURRENT Effect Schema.Struct behavior for unknown top-level
  // (and nested) keys: they are silently accepted and STRIPPED, not
  // thrown on and not preserved. Verified directly against
  // Schema.decodeSync(DockerDoctorConfigSchema)({ rules: {...}, unknownKey: "surprise" })
  // before this migration: result was `{"rules":{"foo":"error"}}` with
  // "unknownKey" absent from the decoded output (no throw).
  // The hand-rolled validator introduced in Step 3 MUST match this exactly.
  test("silently strips unknown top-level keys instead of throwing", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        rules: { "no-latest-tag": "error" },
        unknownTopLevelKey: "surprise",
      })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ rules: { "no-latest-tag": "error" } });
    expect(config).not.toHaveProperty("unknownTopLevelKey");
  });

  test("silently strips unknown keys nested under categories", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        categories: { "Best Practices": "warning", UnknownCategory: "error" },
      })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual(
      expectPartialCategories({
        categories: { "Best Practices": "warning" },
      })
    );
  });

  test("silently strips unknown keys nested under ignore", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        ignore: { files: ["a"], unknownSubKey: true },
      })
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ ignore: { files: ["a"] } });
  });
});
