import fs from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

import { ConfigError } from "../errors";
import type { DockerDoctorConfig } from "../schemas/config";
import { validateConfig } from "../schemas/config";
import { collectUnknownConfigKeys } from "./unknown-keys";

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const parseConfigFile = async (
  filePath: string,
  format: "JSON" | "YAML",
  parse: (content: string) => unknown
): Promise<unknown> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parse(content);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new ConfigError({
      message: `Failed to parse config ${format}: ${msg}`,
    });
  }
};

// Node < 22.18 (no default type stripping) cannot import a .ts config.
const NODE_CANNOT_LOAD_TS_CODES = new Set([
  "ERR_UNKNOWN_FILE_EXTENSION",
  "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING",
]);

const TYPESCRIPT_CONFIG_PATTERN = /\.[cm]?ts$/u;

// Exported for tests: under Bun the import always succeeds, so the predicate
// is the only part of this branch that can be covered directly.
export const isTypeScriptImportUnsupported = (
  filePath: string,
  error: unknown
): boolean =>
  TYPESCRIPT_CONFIG_PATTERN.test(filePath) &&
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "string" &&
  NODE_CANNOT_LOAD_TS_CODES.has(error.code);

const importConfig = async (filePath: string): Promise<unknown> => {
  if (filePath.endsWith(".json")) {
    return parseConfigFile(filePath, "JSON", JSON.parse);
  }

  if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return parseConfigFile(filePath, "YAML", parseYaml);
  }

  try {
    const configModule = await import(filePath);
    return configModule.default || configModule;
  } catch (error: unknown) {
    if (isTypeScriptImportUnsupported(filePath, error)) {
      throw new ConfigError({
        message: `Cannot load ${filePath}: this Node.js version (${process.version}) cannot import TypeScript config files. Use Node.js 22.18 or newer, or rename the config to docker-doctor.config.yaml / .json.`,
      });
    }

    const msg = error instanceof Error ? error.message : String(error);
    throw new ConfigError({
      message: `Failed to load config file ${filePath}: ${msg}`,
    });
  }
};

const warnUnknownKeys = (
  raw: unknown,
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
  let configObject: unknown = null;

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

    if (!configObject) {
      const pkgPath = path.join(rootDir, "package.json");
      if (await fileExists(pkgPath)) {
        try {
          const pkgContent = await fs.readFile(pkgPath, "utf-8");
          const pkgJson = JSON.parse(pkgContent);
          if (pkgJson.dockerDoctor) {
            configObject = pkgJson.dockerDoctor;
          }
        } catch {
          // ignore package.json read/parse failures
        }
      }
    }
  }

  if (!configObject) {
    return {};
  }

  try {
    const config = validateConfig(configObject);
    if (onWarning) {
      warnUnknownKeys(configObject, onWarning);
    }
    return config;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new ConfigError({
      message: `Invalid configuration format: ${msg}`,
    });
  }
};
