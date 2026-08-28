import type { ComposeRule, Diagnostic } from "../types/index";
import { createDiagnostic } from "./create-diagnostic";
import { isSecretKey } from "./secret-keywords";

const DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * Narrows an unknown compose document to its service entries. Services with
 * a null/scalar body are skipped, matching the other compose rules.
 */
const composeServices = (
  composeContent: unknown
): [string, Record<string, unknown>][] => {
  if (
    !composeContent ||
    typeof composeContent !== "object" ||
    !("services" in composeContent)
  ) {
    return [];
  }
  const { services } = composeContent as { services?: unknown };
  if (!services || typeof services !== "object") {
    return [];
  }
  return Object.entries(services).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      Boolean(entry[1]) && typeof entry[1] === "object"
  );
};

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

const mountsDockerSocket = (volume: unknown): boolean => {
  if (typeof volume === "string") {
    // Short syntax: SOURCE:TARGET[:MODE] (or a bare volume name).
    return volume.split(":")[0] === DOCKER_SOCKET;
  }
  if (volume && typeof volume === "object") {
    return (volume as Record<string, unknown>).source === DOCKER_SOCKET;
  }
  return false;
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
