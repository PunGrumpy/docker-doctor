import {
  isComposeMapping,
  isComposeNumber,
  isComposeSequence,
  isComposeString,
} from "../parsers/compose-value";
import type {
  ComposeMapping,
  ComposeRule,
  ComposeValue,
  Diagnostic,
} from "../types/index";
import { parseComposeImage } from "./compose-images";
import { applyFoldsAndDefaults, volumeMount } from "./compose-mounts";
import { composeServices } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";

const WILDCARD_ADDRESSES = new Set(["", "0.0.0.0", "::"]);

const QDRANT_API_KEY = "QDRANT__SERVICE__API_KEY";
const QDRANT_CONFIG_DIR = "/qdrant/config";
const MCP_GATEWAY_NO_AUTH_FLAG = "--allow-unauthenticated";
const WHITESPACE = /\s+/u;
const BRACKETED_ADDRESS = /^\[(?<inner>.*)\]$/u;

// Colons inside `${VAR:-default}` and `[::1]` belong to the part they sit in.
const splitOnTopLevelColons = (spec: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of spec) {
    if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth = Math.max(0, depth - 1);
    }

    if (char === ":" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current);

  return parts;
};

// An address that still depends on a variable is unknown, and an unknown
// address is not reported.
const bindsAllInterfaces = (address: string): boolean => {
  const resolved = applyFoldsAndDefaults(address.trim());

  if (resolved.includes("$")) {
    return false;
  }

  return WILDCARD_ADDRESSES.has(resolved.replace(BRACKETED_ADDRESS, "$1"));
};

const HOST_IP_PART_COUNT = 3;

export const publishedOnAllInterfaces = (entry: ComposeValue): boolean => {
  if (isComposeNumber(entry)) {
    return true;
  }

  if (isComposeString(entry)) {
    const parts = splitOnTopLevelColons(entry);

    return parts.length < HOST_IP_PART_COUNT || bindsAllInterfaces(parts[0]);
  }

  if (isComposeMapping(entry)) {
    const hostIp = entry.host_ip;

    if (isComposeString(hostIp)) {
      return bindsAllInterfaces(hostIp);
    }

    return hostIp === undefined || hostIp === null;
  }

  return false;
};

/**
 * The literal values a service gives its environment variables, in map or
 * list form. A bare `KEY` or a null value passes the host value through, so
 * it has no literal here. A later list entry replaces an earlier one, as in
 * Compose.
 */
export const environmentVariables = (
  config: ComposeMapping
): Map<string, string> => {
  const variables = new Map<string, string>();
  const { environment } = config;

  if (isComposeMapping(environment)) {
    for (const [key, value] of Object.entries(environment)) {
      if (isComposeString(value) || isComposeNumber(value)) {
        variables.set(key, String(value));
      }
    }
  } else if (isComposeSequence(environment)) {
    for (const entry of environment) {
      const eqIndex = isComposeString(entry) ? entry.indexOf("=") : -1;

      if (isComposeString(entry) && eqIndex > 0) {
        variables.set(entry.slice(0, eqIndex), entry.slice(eqIndex + 1));
      }
    }
  }

  return variables;
};

const isBlank = (value: ComposeValue | undefined): boolean =>
  isComposeString(value) && value.trim() === "";

// A bare `KEY` or a null value passes the host value through, so it counts as set.
const hasEnvironmentKey = (config: ComposeMapping, key: string): boolean => {
  const { environment } = config;

  if (isComposeMapping(environment)) {
    return environment[key] !== undefined && !isBlank(environment[key]);
  }

  if (!isComposeSequence(environment)) {
    return false;
  }

  return environment.some((entry) => {
    if (!isComposeString(entry)) {
      return false;
    }

    const [name, ...value] = entry.split("=");

    return (
      name === key && (value.length === 0 || value.join("=").trim() !== "")
    );
  });
};

// An `env_file` can set `QDRANT__SERVICE__API_KEY`, and Compose reads it
// after the file list is resolved, so the rule cannot see what it holds.
const hasEnvFile = (config: ComposeMapping): boolean => {
  const { env_file: envFile } = config;

  if (isComposeString(envFile)) {
    return envFile.trim() !== "";
  }

  return isComposeSequence(envFile) && envFile.length > 0;
};

// Qdrant reads `service.api_key` from the YAML files in its `config`
// directory, which the official image keeps at `/qdrant/config`. A mount
// there can carry the key.
const mountsQdrantConfig = (config: ComposeMapping): boolean => {
  const { volumes } = config;

  if (!isComposeSequence(volumes)) {
    return false;
  }

  return volumes.some((volume) => {
    const target = volumeMount(volume)?.target;

    return (
      target !== undefined &&
      (target === QDRANT_CONFIG_DIR ||
        target.startsWith(`${QDRANT_CONFIG_DIR}/`))
    );
  });
};

export const commandTokens = (command: ComposeValue | undefined): string[] => {
  if (isComposeString(command)) {
    return command.split(WHITESPACE);
  }

  return isComposeSequence(command)
    ? command.filter((token) => isComposeString(token))
    : [];
};

const allowsUnauthenticated = (config: ComposeMapping): boolean =>
  commandTokens(config.command).some(
    (token) =>
      token === MCP_GATEWAY_NO_AUTH_FLAG ||
      token === `${MCP_GATEWAY_NO_AUTH_FLAG}=true`
  );

interface UnauthenticatedService {
  hasAuth: (config: ComposeMapping) => boolean;
  product: string;
  repository: string;
}

const UNAUTHENTICATED_SERVICES: readonly UnauthenticatedService[] = [
  {
    hasAuth: () => false,
    product: "Ollama",
    repository: "ollama/ollama",
  },
  {
    hasAuth: (config) =>
      hasEnvironmentKey(config, QDRANT_API_KEY) ||
      hasEnvFile(config) ||
      mountsQdrantConfig(config),
    product: "Qdrant",
    repository: "qdrant/qdrant",
  },
  {
    hasAuth: (config) => !allowsUnauthenticated(config),
    product: "MCP gateway",
    repository: "docker/mcp-gateway",
  },
];

const exposedProduct = (config: ComposeMapping): string | undefined => {
  const { build, image } = config;

  if (build !== undefined || !isComposeString(image)) {
    return undefined;
  }

  const repository = parseComposeImage(image)?.repository;

  const row = UNAUTHENTICATED_SERVICES.find(
    (service) => service.repository === repository
  );

  return row && !row.hasAuth(config) ? row.product : undefined;
};

const isHostNetwork = (config: ComposeMapping): boolean =>
  isComposeString(config.network_mode) &&
  config.network_mode.trim().toLowerCase() === "host";

const exposingPath = (
  config: ComposeMapping
): (string | number)[] | undefined => {
  if (isHostNetwork(config)) {
    return ["network_mode"];
  }

  const { ports } = config;

  if (!isComposeSequence(ports)) {
    return undefined;
  }

  const index = ports.findIndex((entry) => publishedOnAllInterfaces(entry));

  return index === -1 ? undefined : ["ports", index];
};

export const noExposedUnauthenticatedService: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const product = exposedProduct(config);
      const path = product === undefined ? undefined : exposingPath(config);

      if (path !== undefined) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' publishes ${product} on all interfaces, and ${product} has no authentication here. Anyone who can reach this host can use it.`,
            this.help,
            context?.locate?.(["services", name, ...path])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Bind the port to loopback (`127.0.0.1:11434:11434`), or drop `ports` and reach the service over an internal network, or put an authenticating proxy in front of it.",
  key: "docker-doctor/no-exposed-unauthenticated-service",
  message: "Do not publish unauthenticated AI services on all interfaces",
};

export const composePortsRules = [noExposedUnauthenticatedService];
