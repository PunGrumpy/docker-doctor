import type { ComposeRule, Diagnostic } from "../types/index";
import { composeServices } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";
import { isSecretKey } from "./secret-keywords";

export const noPrivilegedService: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      if (config.privileged === true) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' runs in privileged mode. A privileged container has full access to the host's devices and kernel, so compromising this service compromises the host.`,
            this.help,
            context?.locate?.(["services", name, "privileged"])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Remove `privileged: true` and grant only what the service needs: specific capabilities via `cap_add`, or individual device access via `devices`.",
  key: "docker-doctor/no-privileged-service",
  message: "Do not run services in privileged mode",
};

const DOCKER_SOCKET_TARGET = "/var/run/docker.sock";

// `${VAR:-default}` resolves to its default; `${VAR}`, `$VAR` and the
// `?error` forms resolve to nothing.
const INTERPOLATION_WITH_DEFAULT = /\$\{[^}:?-]+:?-(?<fallback>[^}]*)\}/gu;
const INTERPOLATION_WITHOUT_DEFAULT = /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/gu;

const resolveInterpolationDefaults = (value: string): string =>
  value
    .replace(INTERPOLATION_WITH_DEFAULT, (_match, fallback: string) => fallback)
    .replace(INTERPOLATION_WITHOUT_DEFAULT, "");

// Named volumes cannot start with a path prefix, so only path-shaped
// sources are bind mounts.
const PATH_SHAPED = /^(?:[/.~]|[A-Za-z]:)/u;

const isDockerSocketPath = (rawPath: string): boolean => {
  const normalized = rawPath.replaceAll("\\", "/");
  return (
    PATH_SHAPED.test(normalized) &&
    (normalized.endsWith("/docker.sock") ||
      normalized.endsWith("/pipe/docker_engine"))
  );
};

// `[SOURCE:]TARGET[:MODE]`, where a `${VAR:-default}` source has its own colon.
const splitShortSyntax = (spec: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of spec) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
    if (char === ":" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
};

interface VolumeMount {
  source: string | undefined;
  target: string | undefined;
}

const volumeMount = (volume: unknown): VolumeMount | undefined => {
  if (typeof volume === "string") {
    const [source, target] = splitShortSyntax(volume);
    // A lone path is an anonymous volume at that target, not a bind mount.
    return target === undefined ? undefined : { source, target };
  }
  if (volume && typeof volume === "object") {
    const { source, target } = volume as Record<string, unknown>;
    return {
      source: typeof source === "string" ? source : undefined,
      target: typeof target === "string" ? target : undefined,
    };
  }
  return undefined;
};

const mountsDockerSocket = (volume: unknown): boolean => {
  const mount = volumeMount(volume);
  if (!mount?.source) {
    return false;
  }
  const resolvedSource = resolveInterpolationDefaults(mount.source);
  if (resolvedSource !== "") {
    return isDockerSocketPath(resolvedSource);
  }
  // A bare `${VAR}` source names no host path; the target still can.
  return (
    resolveInterpolationDefaults(mount.target ?? "") === DOCKER_SOCKET_TARGET
  );
};

export const noDockerSocketMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { volumes } = config;
      if (!Array.isArray(volumes)) {
        continue;
      }
      for (const [index, volume] of volumes.entries()) {
        if (mountsDockerSocket(volume)) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Service '${name}' bind-mounts the Docker socket. Anything running in this container can control the Docker daemon: start privileged containers, read every volume, and escape to the host.`,
              this.help,
              context?.locate?.(["services", name, "volumes", index])
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "If the service genuinely needs the Docker API (agent tooling like MCP gateways often does), prefer `use_api_socket: true` or a filtering socket proxy over a raw bind mount of `/var/run/docker.sock`.",
  key: "docker-doctor/no-docker-socket-mount",
  message: "Do not bind-mount the Docker socket into services",
};

const isLiteralSecretValue = (value: unknown): boolean =>
  // `$VAR` / `${VAR}` are interpolated from the host environment at
  // `compose up` time, so the compose file itself holds no secret.
  typeof value === "string" && value.length > 0 && !value.startsWith("$");

export const noPlaintextSecrets: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    const flag = (name: string, key: string, line: number | undefined) => {
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          `Potential secret in service '${name}' environment: '${key}'. A literal value here lives in version control in plain text.`,
          this.help,
          line
        )
      );
    };

    for (const [name, config] of composeServices(composeContent)) {
      const { environment } = config;

      if (Array.isArray(environment)) {
        // List syntax: "KEY=value" entries; a bare "KEY" passes the host
        // value through and holds no literal.
        for (const [index, entry] of environment.entries()) {
          if (typeof entry !== "string") {
            continue;
          }
          const eqIndex = entry.indexOf("=");
          if (eqIndex <= 0) {
            continue;
          }
          const key = entry.slice(0, eqIndex);
          const value = entry.slice(eqIndex + 1);
          if (isSecretKey(key) && isLiteralSecretValue(value)) {
            flag(
              name,
              key,
              context?.locate?.(["services", name, "environment", index])
            );
          }
        }
      } else if (environment && typeof environment === "object") {
        for (const [key, value] of Object.entries(environment)) {
          if (isSecretKey(key) && isLiteralSecretValue(value)) {
            flag(
              name,
              key,
              context?.locate?.(["services", name, "environment", key])
            );
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  // oxlint-disable-next-line no-template-curly-in-string -- Compose interpolation syntax, shown literally
  help: "Move the value to an `env_file` kept out of version control, interpolate it from the host environment (`${VAR}`), or use Compose `secrets:`.",
  key: "docker-doctor/no-plaintext-secrets",
  message: "Avoid literal secret values in Compose environment",
};

export const composeSecurityRules = [
  noPrivilegedService,
  noDockerSocketMount,
  noPlaintextSecrets,
];
