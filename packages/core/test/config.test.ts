import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadConfig } from "../src/config/loader";
import { ConfigError } from "../src/errors";

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

  test("warns about unknown rule and category keys", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        categories: { Security: "error", security: "error" },
        rules: {
          "docker-doctor/no-root-user": "error",
          "docker-doctor/no-root-users": "error",
        },
      })
    );

    const warnings: string[] = [];
    await loadConfig(dir, undefined, (message) => warnings.push(message));

    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("docker-doctor/no-root-users");
    expect(warnings[1]).toContain('"security"');
    // The correctly-spelled keys are never reported as unknown. (The hint
    // text quotes "Security" as an example, so match the full phrase.)
    expect(warnings.join(" ")).not.toContain('Unknown category "Security"');
    expect(warnings.join(" ")).not.toContain(
      'Unknown rule "docker-doctor/no-root-user"'
    );
  });

  test("stays silent for a fully valid config", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        categories: { "Best Practices": "info" },
        rules: { "docker-doctor/no-root-user": "off" },
      })
    );

    const warnings: string[] = [];
    await loadConfig(dir, undefined, (message) => warnings.push(message));

    expect(warnings).toEqual([]);
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
    expect(config).toEqual({ categories: { Security: "warning" } });
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
    expect(config).toEqual({
      categories: { "Best Practices": "warning" },
    });
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

  test("loads a .yaml config", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      [
        "rules:",
        '  "docker-doctor/no-root-user": error',
        "categories:",
        '  "Image Size": "off"',
        "ignore:",
        "  files:",
        '    - "examples/**/Dockerfile"',
        "",
      ].join("\n")
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({
      categories: { "Image Size": "off" },
      ignore: { files: ["examples/**/Dockerfile"] },
      rules: { "docker-doctor/no-root-user": "error" },
    });
  });

  test("loads a .yml config", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yml"),
      'rules:\n  "docker-doctor/no-root-user": warning\n'
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({
      rules: { "docker-doctor/no-root-user": "warning" },
    });
  });

  test("prefers .json config over .yaml when both exist", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "from-json": "error" } })
    );
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      'rules:\n  "from-yaml": warning\n'
    );
    const config = await loadConfig(dir);
    expect(config).toEqual({ rules: { "from-json": "error" } });
  });

  test("throws ConfigError on malformed YAML", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      "rules:\n  bad: [unclosed\n"
    );
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
  });

  test("throws ConfigError on invalid severity in YAML", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      'rules:\n  "no-latest-tag": banana\n'
    );
    await expect(loadConfig(dir)).rejects.toThrow(ConfigError);
  });

  test("loads a .yaml config via --config custom path", async () => {
    await fs.writeFile(
      path.join(dir, "custom.yaml"),
      "categories:\n  Security: error\n"
    );
    const config = await loadConfig(dir, "custom.yaml");
    expect(config).toEqual({ categories: { Security: "error" } });
  });
});
