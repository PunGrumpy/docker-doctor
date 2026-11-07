import { isComposeSequence, isComposeString } from "../parsers/compose-value";
import type { ComposeMapping } from "../types/index";
import { parseComposeImage } from "./compose-images";
import { applyFoldsAndDefaults } from "./compose-mounts";
import {
  commandTokens,
  environmentVariables,
  publishedOnAllInterfaces,
} from "./compose-ports";

type ProxyFamily = "linuxserver" | "tecnativa" | "wollomatic";

const SOCKET_PROXY_REGISTRIES = new Set([
  "docker.io",
  "ghcr.io",
  "index.docker.io",
  "lscr.io",
]);

// The linuxserver proxy is a drop-in replacement for the Tecnativa one. It
// reads the same variables and adds a few of its own.
const SOCKET_PROXY_FAMILIES = new Map<string, ProxyFamily>([
  ["linuxserver/socket-proxy", "linuxserver"],
  ["tecnativa/docker-socket-proxy", "tecnativa"],
  ["wollomatic/socket-proxy", "wollomatic"],
]);

const socketProxyFamily = (config: ComposeMapping): ProxyFamily | undefined => {
  const { build, image } = config;

  if (build !== undefined || !isComposeString(image)) {
    return undefined;
  }

  const parsed = parseComposeImage(image);

  if (
    parsed === undefined ||
    (parsed.registry !== undefined &&
      !SOCKET_PROXY_REGISTRIES.has(parsed.registry))
  ) {
    return undefined;
  }

  return SOCKET_PROXY_FAMILIES.get(parsed.repository);
};

export const isSocketProxy = (config: ComposeMapping): boolean =>
  socketProxyFamily(config) !== undefined;

interface WriteSection {
  reason: string;
  section: string;
}

// The Tecnativa README says that with `POST` off every section is read-only.
// Its HAProxy config denies any request that is not GET or HEAD unless `POST`
// is on, `/auth` accepts only POST, and `GET /secrets` returns no secret
// data. So every section here counts only together with `POST`.
const TECNATIVA_SECTIONS: readonly WriteSection[] = [
  {
    reason: "can create containers (POST and CONTAINERS are on)",
    section: "CONTAINERS",
  },
  {
    reason: "can run commands in containers (POST and EXEC are on)",
    section: "EXEC",
  },
  {
    reason: "can build images (POST and BUILD are on)",
    section: "BUILD",
  },
  {
    reason:
      "can create swarm services, which can bind-mount the host root (POST and SERVICES are on)",
    section: "SERVICES",
  },
  {
    reason: "can install plugins (POST and PLUGINS are on)",
    section: "PLUGINS",
  },
  {
    reason: "can change the swarm (POST and SWARM are on)",
    section: "SWARM",
  },
  {
    reason: "can call the registry login endpoint (POST and AUTH are on)",
    section: "AUTH",
  },
  {
    reason: "can create and remove swarm secrets (POST and SECRETS are on)",
    section: "SECRETS",
  },
];

// The parameter table of the linuxserver README adds `LIBPOD_CONTAINERS`
// (`/libpod/containers`) and `ALLOW_ARCHIVE` (`/containers/{id}/archive`,
// where a PUT writes files into a container). The Tecnativa image has
// neither.
const LINUXSERVER_SECTIONS: readonly WriteSection[] = [
  ...TECNATIVA_SECTIONS,
  {
    reason: "can create Podman containers (POST and LIBPOD_CONTAINERS are on)",
    section: "LIBPOD_CONTAINERS",
  },
  {
    reason: "can copy files into containers (POST and ALLOW_ARCHIVE are on)",
    section: "ALLOW_ARCHIVE",
  },
];

// The proxy tests each variable with HAProxy's `-m bool`, which reads the
// value as an integer. `1` turns a section on and `true` does not.
const NON_ZERO_INTEGER = /^[+-]?0*[1-9]/u;

// A value that still depends on a variable is unknown, and an unknown value
// leaves the section off.
const isSectionOn = (
  variables: ReadonlyMap<string, string>,
  section: string
): boolean => {
  const value = applyFoldsAndDefaults(variables.get(section)?.trim() ?? "");

  return !value.includes("$") && NON_ZERO_INTEGER.test(value);
};

const SECTIONS_BY_FAMILY = {
  linuxserver: LINUXSERVER_SECTIONS,
  tecnativa: TECNATIVA_SECTIONS,
} as const;

const sectionsRisk = (
  config: ComposeMapping,
  sections: readonly WriteSection[]
): string | undefined => {
  const variables = environmentVariables(config);

  if (!isSectionOn(variables, "POST")) {
    return undefined;
  }

  return sections.find(({ section }) => isSectionOn(variables, section))
    ?.reason;
};

// `-allowPOST=regex` and `--allowPOST regex`, as a Go flag, and the same for
// PUT and DELETE. The Docker API changes things with those three methods. A
// bare flag takes the next token as its value.
const ALLOW_FLAG =
  /^["']?--?allow(?<method>POST|PUT|DELETE)(?:=(?<pattern>.*))?$/u;

// `SP_ALLOW_POST` and the numbered `SP_ALLOW_POST_2` that follows it.
const ALLOW_ENV = /^SP_ALLOW_(?<method>POST|PUT|DELETE)(?:_.*)?$/u;

// An empty pattern allows nothing, written bare or in shell quotes.
const EMPTY_PATTERN = /^(?:""|'')?$/u;

const methodFromFlags = (tokens: readonly string[]): string | undefined => {
  for (const [index, token] of tokens.entries()) {
    const groups = ALLOW_FLAG.exec(token)?.groups;

    if (groups !== undefined) {
      const pattern = groups.pattern ?? tokens[index + 1];

      if (pattern === undefined || !EMPTY_PATTERN.test(pattern)) {
        return groups.method;
      }
    }
  }

  return undefined;
};

const methodFromEnvironment = (config: ComposeMapping): string | undefined => {
  for (const [key, value] of environmentVariables(config)) {
    const method = ALLOW_ENV.exec(key)?.groups?.method;

    if (method !== undefined && value.trim() !== "") {
      return method;
    }
  }

  return undefined;
};

const wollomaticRisk = (config: ComposeMapping): string | undefined => {
  const method =
    methodFromFlags(commandTokens(config.command)) ??
    methodFromEnvironment(config);

  return method === undefined
    ? undefined
    : `allows ${method} requests (-allow${method} or SP_ALLOW_${method})`;
};

const publishesPort = (config: ComposeMapping): boolean =>
  isComposeSequence(config.ports) &&
  config.ports.some((entry) => publishedOnAllInterfaces(entry));

/**
 * Why a Docker socket proxy is not read-only, as a phrase that follows
 * "its socket proxy", or undefined for a proxy that shows no write path and
 * for a service that is not a proxy. A proxy that can change things, or that
 * any host on the network can reach, gives away the same control as the raw
 * socket. The write paths are the common ones, not a complete list.
 */
export const socketProxyRisk = (config: ComposeMapping): string | undefined => {
  const family = socketProxyFamily(config);

  if (family === undefined) {
    return undefined;
  }

  const writeRisk =
    family === "wollomatic"
      ? wollomaticRisk(config)
      : sectionsRisk(config, SECTIONS_BY_FAMILY[family]);

  if (writeRisk !== undefined) {
    return writeRisk;
  }

  return publishesPort(config)
    ? "publishes its port on every interface"
    : undefined;
};
