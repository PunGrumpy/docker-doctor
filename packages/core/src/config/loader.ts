import fs from "node:fs/promises";
import path from "node:path";

import { parse as parseYaml } from "yaml";

import { ConfigError } from "../errors";
import type { DockerDoctorConfig } from "../schemas/config";
import { validateConfig } from "../schemas/config";

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
    const msg = error instanceof Error ? error.message : String(error);
    throw new ConfigError({
      message: `Failed to load config file ${filePath}: ${msg}`,
    });
  }
};

export const loadConfig = async (
  rootDir: string,
  customPath?: string
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
    return validateConfig(configObject);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new ConfigError({
      message: `Invalid configuration format: ${msg}`,
    });
  }
};
