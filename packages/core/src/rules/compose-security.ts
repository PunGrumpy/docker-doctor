import type { ComposeRule, Diagnostic } from "../types/index";
import type { HostPathScope } from "./compose-mounts";
import {
  bindMountSource,
  classifyHostPath,
  mountsDockerSocket,
  volumeMount,
} from "./compose-mounts";
import { composeServices } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";
import { isLiteralSecretValue, isSecretKey } from "./secret-keywords";

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
        const mount = volumeMount(volume);
        if (mount && mountsDockerSocket(mount)) {
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

const BROAD_SCOPE_REASONS: Partial<Record<HostPathScope, string>> = {
  home: "the whole home directory",
  "home-dotfile":
    "a hidden directory under the home directory, where credentials and tool configuration live",
  parent: "a directory above the Compose project",
  root: "the host's root filesystem",
  system: "a host system directory",
};

export const noBroadBindMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { volumes } = config;
      if (!Array.isArray(volumes)) {
        continue;
      }
      for (const [index, volume] of volumes.entries()) {
        const mount = volumeMount(volume);
        if (!mount || mountsDockerSocket(mount)) {
          continue;
        }
        const source = bindMountSource(mount);
        if (source === undefined) {
          continue;
        }
        const reason = BROAD_SCOPE_REASONS[classifyHostPath(source)];
        if (reason === undefined) {
          continue;
        }
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' bind-mounts '${source}', ${reason}. Everything under it is readable by the container, and a writable mount is the foothold for VM-escape bugs like CVE-2026-77179.`,
            this.help,
            context?.locate?.(["services", name, "volumes", index])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Mount the narrowest directory the service actually reads (`./data`, not `~` or `/`), and add `:ro` unless the service must write to it. Host paths the service only needs at build time belong in the image instead.",
  key: "docker-doctor/no-broad-bind-mount",
  message: "Do not bind-mount broad host directories into services",
};

export const preferReadOnlyBindMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { volumes } = config;
      if (!Array.isArray(volumes)) {
        continue;
      }
      for (const [index, volume] of volumes.entries()) {
        const mount = volumeMount(volume);
        if (!mount || mount.readOnly || mountsDockerSocket(mount)) {
          continue;
        }
        const source = bindMountSource(mount);
        if (source === undefined || classifyHostPath(source) === "project") {
          continue;
        }
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' bind-mounts host path '${source}' read-write. A writable host mount lets the container change files outside the project, and is the foothold for VM-escape bugs like CVE-2026-77179.`,
            this.help,
            context?.locate?.(["services", name, "volumes", index])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Append `:ro` to the short syntax, or set `read_only: true` in the long syntax, unless the service must write to the host path.",
  key: "docker-doctor/prefer-read-only-bind-mount",
  message: "Bind mounts outside the project should be read-only",
};

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
          if (
            isSecretKey(key) &&
            typeof value === "string" &&
            isLiteralSecretValue(value)
          ) {
            flag(
              name,
              key,
              context?.locate?.(["services", name, "environment", index])
            );
          }
        }
      } else if (environment && typeof environment === "object") {
        for (const [key, value] of Object.entries(environment)) {
          if (
            isSecretKey(key) &&
            typeof value === "string" &&
            isLiteralSecretValue(value)
          ) {
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
  noBroadBindMount,
  preferReadOnlyBindMount,
  noPlaintextSecrets,
];
