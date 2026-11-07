import { isComposeSequence, isComposeString } from "../parsers/compose-value";
import type { ComposeMapping } from "../types/index";
import { parseComposeImage } from "./compose-images";
import { applyFoldsAndDefaults } from "./compose-mounts";
import {
  commandTokens,
  environmentVariables,
  publishedOnAllInterfaces,
} from "./compose-ports";

type ProxyFamily = "tecnativa" | "wollomatic";

const SOCKET_PROXY_REGISTRIES = new Set([
  "docker.io",
  "ghcr.io",
  "index.docker.io",
  "lscr.io",
]);

// The linuxserver proxy is a drop-in replacement for the Tecnativa one and
// reads the same variables.
const SOCKET_PROXY_FAMILIES = new Map<string, ProxyFamily>([
  ["linuxserver/socket-proxy", "tecnativa"],
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

interface TecnativaSection {
  needsPost: boolean;
  reason: string;
  section: string;
}

// The proxy README names AUTH, SECRETS and POST as security-critical. POST
// only matters together with a section that has calls to make.
const TECNATIVA_SECTIONS: readonly TecnativaSection[] = [
  {
    needsPost: true,
    reason: "lets clients create containers (POST and CONTAINERS are on)",
    section: "CONTAINERS",
  },
  {
    needsPost: true,
    reason: "lets clients run commands in containers (POST and EXEC are on)",
    section: "EXEC",
  },
  {
    needsPost: true,
    reason: "lets clients build images (POST and BUILD are on)",
    section: "BUILD",
  },
  {
    needsPost: false,
    reason: "turns on AUTH, which its documentation calls security-critical",
    section: "AUTH",
  },
  {
    needsPost: false,
    reason: "turns on SECRETS, which its documentation calls security-critical",
    section: "SECRETS",
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

const tecnativaRisk = (config: ComposeMapping): string | undefined => {
  const variables = environmentVariables(config);
  const postOn = isSectionOn(variables, "POST");

  return TECNATIVA_SECTIONS.find(
    ({ needsPost, section }) =>
      (postOn || !needsPost) && isSectionOn(variables, section)
  )?.reason;
};

// `-allowPOST=regex` and `--allowPOST regex`, as a Go flag. An empty regex
// allows nothing.
const ALLOW_POST_FLAG = /^["']?--?allowPOST(?:=(?<regex>.*))?$/u;

// `SP_ALLOW_POST` and the numbered `SP_ALLOW_POST_2` that follows it.
const ALLOW_POST_ENV = /^SP_ALLOW_POST(?:_.*)?$/u;

const isAllowPostFlag = (token: string): boolean => {
  const match = ALLOW_POST_FLAG.exec(token);

  return match !== null && match.groups?.regex !== "";
};

const wollomaticRisk = (config: ComposeMapping): string | undefined => {
  const flagged = commandTokens(config.command).some(isAllowPostFlag);

  const configured = [...environmentVariables(config)].some(
    ([key, value]) => ALLOW_POST_ENV.test(key) && value.trim() !== ""
  );

  return flagged || configured
    ? "allows POST requests (-allowPOST or SP_ALLOW_POST)"
    : undefined;
};

const publishesPort = (config: ComposeMapping): boolean =>
  isComposeSequence(config.ports) &&
  config.ports.some((entry) => publishedOnAllInterfaces(entry));

/**
 * Why a Docker socket proxy is not read-only, or undefined for a read-only
 * proxy and for a service that is not a proxy. A proxy that can change
 * things, or that any host on the network can reach, gives away the same
 * control as the raw socket.
 */
export const socketProxyRisk = (config: ComposeMapping): string | undefined => {
  const family = socketProxyFamily(config);

  if (family === undefined) {
    return undefined;
  }

  const writeRisk =
    family === "wollomatic" ? wollomaticRisk(config) : tecnativaRisk(config);

  if (writeRisk !== undefined) {
    return writeRisk;
  }

  return publishesPort(config)
    ? "publishes its port on all host interfaces"
    : undefined;
};
