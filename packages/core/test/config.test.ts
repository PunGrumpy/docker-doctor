import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadConfig, typeStrippingFailure } from "../src/config/loader";
import { ConfigError } from "../src/errors";

const failureMessage = async (
  configDir: string,
  customPath?: string
): Promise<string> => {
  try {
    await loadConfig(configDir, customPath);
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.message;
    }

    throw error;
  }

  throw new Error("loadConfig should have thrown a ConfigError");
};

const collectWarnings = async (
  configDir: string,
  customPath?: string
): Promise<string[]> => {
  const warnings: string[] = [];
  await loadConfig(configDir, customPath, (message) => {
    warnings.push(message);
  });

  return warnings;
};

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

  test("reads the first config file in lookup order", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      "rules:\n  docker-doctor/no-root-user: info\n"
    );
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "docker-doctor/no-root-user": "error" } })
    );
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.mjs"),
      'export default { rules: { "docker-doctor/no-root-user": "warning" } };\n'
    );

    const config = await loadConfig(dir);
    expect(config.rules).toEqual({ "docker-doctor/no-root-user": "warning" });
  });

  test("warns about unknown rule and category keys with the file and a suggestion", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        categories: { Security: "error", security: "error" },
        rules: {
          "docker-doctor/no-root-user": "error",
          "docker-doctor/no-root-users": "error",
        },
      })
    );

    expect(await collectWarnings(dir)).toEqual([
      `Unknown category "security" in ${file}. Category names are case-sensitive. Did you mean "Security"?`,
      `Unknown rule "docker-doctor/no-root-users" in ${file}. It matches no rule and has no effect. Did you mean "docker-doctor/no-root-user"?`,
    ]);
  });

  test("suggests the full rule key for a bare rule name", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "no-root-user": "off" } })
    );

    const [warning] = await collectWarnings(dir);

    expect(warning).toContain('Unknown rule "no-root-user"');
    expect(warning).toContain('Did you mean "docker-doctor/no-root-user"?');
  });

  test("lists the categories when none is close", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ categories: { Networking: "off" } })
    );

    const [warning] = await collectWarnings(dir);

    expect(warning).toContain('Unknown category "Networking"');
    expect(warning).toContain(
      "Use Best Practices, Compose, Image Size, Performance, Security."
    );
  });

  test("warns about an unknown rule with no close match without a suggestion", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "something/entirely-different": "off" } })
    );

    const [warning] = await collectWarnings(dir);

    expect(warning).toContain('Unknown rule "something/entirely-different"');
    expect(warning).not.toContain("Did you mean");
  });

  test("warns about an unknown top-level key and suggests the close one", async () => {
    const file = path.join(dir, "docker-doctor.config.yaml");
    await fs.writeFile(
      file,
      "rule:\n  docker-doctor/no-root-user: off\nfoo: 1\n"
    );

    expect(await collectWarnings(dir)).toEqual([
      `Unknown config key "rule" in ${file}. docker-doctor ignores it. Did you mean "rules"?`,
      `Unknown config key "foo" in ${file}. docker-doctor ignores it.`,
    ]);
  });

  test("warns about an unknown key under ignore", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    await fs.writeFile(
      file,
      JSON.stringify({ ignore: { file: ["a"], files: ["b"] } })
    );

    expect(await collectWarnings(dir)).toEqual([
      `Unknown config key "ignore.file" in ${file}. docker-doctor ignores it. Did you mean "ignore.files"?`,
    ]);
  });

  test("names package.json when its dockerDoctor key has an unknown key", async () => {
    const file = path.join(dir, "package.json");
    await fs.writeFile(
      file,
      JSON.stringify({ dockerDoctor: { rule: {} }, name: "fixture" })
    );

    expect(await collectWarnings(dir)).toEqual([
      `Unknown config key "rule" in ${file} ("dockerDoctor"). docker-doctor ignores it. Did you mean "rules"?`,
    ]);
  });

  test("does not warn about $schema", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        $schema: "https://docker-doctor.vercel.app/schema.json",
        rules: { "docker-doctor/no-root-user": "off" },
      })
    );

    expect(await collectWarnings(dir)).toEqual([]);
  });

  test("a warning does not change the returned config", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        ignore: { file: ["a"] },
        rule: { "docker-doctor/no-root-user": "off" },
      })
    );

    expect(await collectWarnings(dir)).toHaveLength(2);
    expect(await loadConfig(dir)).toEqual({ ignore: {} });
  });

  test("prints the first 20 unknown keys and counts the rest", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    const config: Record<string, string> = {};

    for (let index = 0; index < 23; index += 1) {
      config[`bogus${index}`] = "x";
    }

    await fs.writeFile(file, JSON.stringify(config));

    const warnings = await collectWarnings(dir);

    expect(warnings).toHaveLength(21);
    expect(warnings[0]).toContain('"bogus0"');
    expect(warnings[19]).toContain('"bogus19"');
    expect(warnings[20]).toBe(`and 3 more unknown keys in ${file}`);
  });

  test("counts a single hidden unknown key in the singular", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    const config: Record<string, string> = {};

    for (let index = 0; index < 21; index += 1) {
      config[`bogus${index}`] = "x";
    }

    await fs.writeFile(file, JSON.stringify(config));

    const warnings = await collectWarnings(dir);

    expect(warnings.at(-1)).toBe(`and 1 more unknown key in ${file}`);
  });

  test("does not run an edit-distance table over a 20,000-character key", async () => {
    const config: Record<string, string> = {};

    for (let index = 0; index < 20; index += 1) {
      config[`${index}`.padEnd(20_000, "x")] = "error";
    }

    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: config })
    );

    const start = performance.now();
    const warnings = await collectWarnings(dir);

    expect(warnings).toHaveLength(20);
    // A full table per key and candidate takes several seconds here. The
    // bound is loose because CI runners are 5 to 10 times slower.
    expect(performance.now() - start).toBeLessThan(1000);
  });

  test("says category names are case-sensitive only for a case difference", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({
        categories: { Performanse: "error", security: "error" },
      })
    );

    const [typo, caseOnly] = await collectWarnings(dir);

    expect(typo).toContain('Did you mean "Performance"?');
    expect(typo).not.toContain("case-sensitive");
    expect(caseOnly).toContain("case-sensitive");
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
    await loadConfig(dir, undefined, (message) => {
      warnings.push(message);
    });

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
    let caught: unknown;

    try {
      await loadConfig(dir);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigError);
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

      if (!(error instanceof ConfigError)) {
        throw error;
      }

      expect(error._tag).toBe("ConfigError");
    }
  });

  test("throws ConfigError when rules is the wrong type", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: "not-an-object" })
    );
    let caught: unknown;

    try {
      await loadConfig(dir);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigError);
  });

  test.each([
    ["null", "null", "null"],
    ["a list", '["a"]', "array"],
    ["a string", '"loud"', "string"],
  ])("names the real type when rules is %s", async (_name, value, type) => {
    const file = path.join(dir, "docker-doctor.config.json");
    await fs.writeFile(file, `{"rules": ${value}}`);

    expect(await failureMessage(dir)).toBe(
      `Invalid configuration in ${file}: "rules" must be an object, got ${type}`
    );
  });

  test("names the config file and lists the valid severities", async () => {
    const file = path.join(dir, "docker-doctor.config.yaml");
    await fs.writeFile(file, 'rules:\n  "no-latest-tag": loud\n');

    expect(await failureMessage(dir)).toBe(
      `Invalid configuration in ${file}: Invalid severity "loud" for rule "no-latest-tag". Use error, warning, info, off.`
    );
  });

  test("lists the valid severities for a category", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ categories: { Security: "loud" } })
    );

    expect(await failureMessage(dir)).toContain(
      'for category "Security". Use error, warning, info, off.'
    );
  });

  test("quotes a short invalid severity", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      JSON.stringify({ rules: { "no-latest-tag": "a".repeat(20) } })
    );

    expect(await failureMessage(dir)).toContain(
      `Invalid severity "${"a".repeat(20)}" for rule "no-latest-tag".`
    );
  });

  test.each([
    [
      "a long string",
      JSON.stringify("ghp_tokenvalue12345abcdefghijklmnop"),
      "a 35-character string",
    ],
    ["a list", '["ghp_tokenvalue12345abcdefghijklmnop"]', "array"],
    ["an object", '{"token": "ghp_tokenvalue12345abcdefghijklmnop"}', "object"],
    ["null", "null", "null"],
    ["a number", "5", "number"],
  ])(
    "names the type, not the value, of a long or structured severity (%s)",
    async (_name, value, got) => {
      await fs.writeFile(
        path.join(dir, "docker-doctor.config.json"),
        `{"rules": {"no-latest-tag": ${value}}}`
      );

      const message = await failureMessage(dir);

      expect(message).toContain(
        `Invalid severity for rule "no-latest-tag", got ${got}. Use error, warning, info, off.`
      );
      expect(message).not.toContain("ghp_");
    }
  );

  test("names the type of a bad category severity", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.json"),
      '{"categories": {"Security": {"token": "ghp_tokenvalue12345abcdefghijklmnop"}}}'
    );

    const message = await failureMessage(dir);

    expect(message).toContain(
      'Invalid severity for category "Security", got object.'
    );
    expect(message).not.toContain("ghp_");
  });

  test("names the config file when the whole config is not an object", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    await fs.writeFile(file, "[1]");

    expect(await failureMessage(dir)).toBe(
      `Invalid configuration in ${file}: The config must be an object, got array`
    );
  });

  test("names the config file when it cannot be parsed", async () => {
    const file = path.join(dir, "docker-doctor.config.json");
    await fs.writeFile(file, "{ nope");

    expect(await failureMessage(dir)).toContain(
      `Failed to parse config JSON in ${file}:`
    );
  });

  test("names package.json when its dockerDoctor key is invalid", async () => {
    const file = path.join(dir, "package.json");
    await fs.writeFile(
      file,
      JSON.stringify({ dockerDoctor: { rules: null }, name: "fixture" })
    );

    expect(await failureMessage(dir)).toBe(
      `Invalid configuration in ${file} ("dockerDoctor"): "rules" must be an object, got null`
    );
  });

  test("names the file given to a custom path", async () => {
    const file = path.join(dir, "custom.yaml");
    await fs.writeFile(file, "rules: []\n");

    expect(await failureMessage(dir, "custom.yaml")).toBe(
      `Invalid configuration in ${file}: "rules" must be an object, got array`
    );
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

  test("explains a .ts config failure by cause, not by Node version", () => {
    const tsConfig = path.join(dir, "docker-doctor.config.ts");

    expect(
      typeStrippingFailure(tsConfig, { code: "ERR_UNKNOWN_FILE_EXTENSION" })
    ).toContain("not stripping TypeScript types");

    // Below node_modules Node refuses at every version, so this one must not
    // tell the user to upgrade.
    const nodeModulesFailure = typeStrippingFailure(tsConfig, {
      code: "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING",
    });

    expect(nodeModulesFailure).toContain("node_modules");
    expect(nodeModulesFailure).not.toContain("22.18");
  });

  test("leaves unrelated config import failures alone", () => {
    const tsConfig = path.join(dir, "docker-doctor.config.ts");

    expect(
      typeStrippingFailure(tsConfig, { code: "ERR_MODULE_NOT_FOUND" })
    ).toBeUndefined();
    expect(
      typeStrippingFailure(path.join(dir, "docker-doctor.config.mjs"), {
        code: "ERR_UNKNOWN_FILE_EXTENSION",
      })
    ).toBeUndefined();
    expect(
      typeStrippingFailure(tsConfig, new Error("no code"))
    ).toBeUndefined();
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

  test("drops unknown top-level keys instead of throwing", async () => {
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

  test("drops unknown keys nested under categories", async () => {
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

  test("drops unknown keys nested under ignore", async () => {
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
    let caught: unknown;

    try {
      await loadConfig(dir);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigError);
  });

  test("throws ConfigError on invalid severity in YAML", async () => {
    await fs.writeFile(
      path.join(dir, "docker-doctor.config.yaml"),
      'rules:\n  "no-latest-tag": banana\n'
    );
    let caught: unknown;

    try {
      await loadConfig(dir);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConfigError);
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
