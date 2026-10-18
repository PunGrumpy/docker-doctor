import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse as parseYaml } from "yaml";

import { ConfigError } from "../errors";
import type { ConfigInput, DockerDoctorConfig } from "../schemas/config";
import { isConfigObject, validateConfig } from "../schemas/config";
import { collectUnknownConfigKeys } from "./unknown-keys";

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
};

const describeError = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

// A config source holds nothing (a falsy value) or an object to validate.
// Anything else fails with the message validation has always given it.
const isConfigExport = (exported: unknown): exported is ConfigInput => {
  const present = Boolean(exported);

  if (!present) {
    return false;
  }

  try {
    return isConfigObject(exported);
  } catch (error: unknown) {
    throw new ConfigError({
      message: `Invalid configuration format: ${describeError(error)}`,
    });
  }
};

const parseConfigFile = async (
  filePath: string,
  format: "JSON" | "YAML"
): Promise<ConfigInput | null> => {
  let parsed: unknown;

  try {
    const content = await fs.readFile(filePath, "utf-8");
    parsed = format === "JSON" ? JSON.parse(content) : parseYaml(content);
  } catch (error: unknown) {
    throw new ConfigError({
      message: `Failed to parse config ${format}: ${describeError(error)}`,
    });
  }

  return isConfigExport(parsed) ? parsed : null;
};

const TYPESCRIPT_CONFIG_PATTERN = /\.[cm]?ts$/u;

// Node refuses a TypeScript config in two distinguishable ways, and only one
// of them is a matter of the runtime being too old, so they do not get the
// same advice.
const TYPE_STRIPPING_FAILURES = new Map([
  [
    "ERR_UNKNOWN_FILE_EXTENSION",
    "this Node.js is not stripping TypeScript types, which needs 22.18 or newer with stripping left on (--no-experimental-strip-types turns it off)",
  ],
  [
    "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING",
    "Node.js never strips TypeScript types for files under node_modules, on any version, so the config has to live outside it",
  ],
]);

const hasErrorCode = (cause: unknown): cause is { readonly code: string } =>
  typeof cause === "object" &&
  cause !== null &&
  "code" in cause &&
  typeof cause.code === "string";

// The module namespace import() resolves to, and a parsed package.json.
// Both are objects whose keys are read before they are checked.
const isKeyedObject = (
  value: unknown
): value is { readonly default?: unknown; readonly dockerDoctor?: unknown } =>
  typeof value === "object" && value !== null;

// Returns the reason Node could not read a TypeScript config, or undefined
// when the failure is something else. Exported for tests: under Bun the
// import always succeeds, so this is the only part of the branch that can be
// covered directly.
export const typeStrippingFailure = (
  filePath: string,
  cause: unknown
): string | undefined => {
  if (!TYPESCRIPT_CONFIG_PATTERN.test(filePath) || !hasErrorCode(cause)) {
    return;
  }

  return TYPE_STRIPPING_FAILURES.get(cause.code);
};

const importConfig = async (filePath: string): Promise<ConfigInput | null> => {
  if (filePath.endsWith(".json")) {
    return await parseConfigFile(filePath, "JSON");
  }

  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return await parseConfigFile(filePath, "YAML");
  }

  let configModule: unknown;

  try {
    // import() takes a URL, not a path. On Windows, Node reads the drive
    // letter of `C:\...` as a URL scheme and rejects it. On every platform
    // it reads `#`, `?` and `%` in a path as URL syntax.
    configModule = await import(pathToFileURL(filePath).href);
  } catch (error: unknown) {
    const reason = typeStrippingFailure(filePath, error);

    if (reason) {
      throw new ConfigError({
        message: `Cannot load ${filePath} on Node.js ${process.version}: ${reason}. A docker-doctor.config.yaml or .json needs no TypeScript support at all.`,
      });
    }

    throw new ConfigError({
      message: `Failed to load config file ${filePath}: ${describeError(error)}`,
    });
  }

  const defaultExport = isKeyedObject(configModule)
    ? configModule.default
    : undefined;

  const hasDefaultExport = Boolean(defaultExport);
  const exported = hasDefaultExport ? defaultExport : configModule;

  return isConfigExport(exported) ? exported : null;
};

const readPackageConfig = async (
  rootDir: string
): Promise<ConfigInput | null> => {
  const pkgPath = path.join(rootDir, "package.json");

  if (!(await fileExists(pkgPath))) {
    return null;
  }

  let dockerDoctor: unknown;

  try {
    const pkgContent = await fs.readFile(pkgPath, "utf-8");
    const pkgJson: unknown = JSON.parse(pkgContent);
    dockerDoctor = isKeyedObject(pkgJson) ? pkgJson.dockerDoctor : undefined;
  } catch {
    // ignore package.json read/parse failures
    return null;
  }

  return isConfigExport(dockerDoctor) ? dockerDoctor : null;
};

const warnUnknownKeys = (
  raw: ConfigInput,
  onWarning: (message: string) => void
): void => {
  const unknown = collectUnknownConfigKeys(raw);

  for (const key of unknown.rules) {
    onWarning(
      `Unknown rule "${key}" in config — it matches no rule and has no effect.`
    );
  }

  for (const key of unknown.categories) {
    onWarning(
      `Unknown category "${key}" in config — categories are case-sensitive (e.g. "Best Practices", "Security").`
    );
  }
};

export const loadConfig = async (
  rootDir: string,
  customPath?: string,
  // Called once per unrecognized config key. Optional so existing callers are
  // unaffected; without it, unknown keys stay silent as before.
  onWarning?: (message: string) => void
): Promise<DockerDoctorConfig> => {
  let configObject: ConfigInput | null = null;

  if (customPath) {
    const fullPath = path.resolve(rootDir, customPath);

    if (!(await fileExists(fullPath))) {
      throw new ConfigError({
        message: `Specified config file not found at ${fullPath}`,
      });
    }

    configObject = await importConfig(fullPath);
  } else {
    const candidates = [
      "docker-doctor.config.ts",
      "docker-doctor.config.js",
      "docker-doctor.config.mjs",
      "docker-doctor.config.cjs",
      "docker-doctor.config.json",
      "docker-doctor.config.yaml",
      "docker-doctor.config.yml",
    ];

    /* eslint-disable no-await-in-loop */
    for (const cand of candidates) {
      const fullPath = path.join(rootDir, cand);

      if (await fileExists(fullPath)) {
        configObject = await importConfig(fullPath);
        break;
      }
    }
    /* eslint-enable no-await-in-loop */

    if (configObject === null) {
      configObject = await readPackageConfig(rootDir);
    }
  }

  if (configObject === null) {
    return {};
  }

  try {
    const config = validateConfig(configObject);

    if (onWarning) {
      warnUnknownKeys(configObject, onWarning);
    }

    return config;
  } catch (error: unknown) {
    throw new ConfigError({
      message: `Invalid configuration format: ${describeError(error)}`,
    });
  }
};
