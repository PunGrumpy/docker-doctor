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
import type { HostPathScope } from "./compose-mounts";
import {
  bindMountSource,
  classifyHostPath,
  isReadOnlyExemptHostPath,
  mountsDockerSocket,
  volumeMount,
} from "./compose-mounts";
import { composeServices, isComposeTrue } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";
import {
  containsProviderToken,
  isLiteralSecretValue,
  isSecretKey,
} from "./secret-keywords";

const CAP_PREFIX = /^CAP_/u;

// Compose passes `cap_add` to Docker, which reads names in any case and
// with or without the `CAP_` prefix.
const normalizeCapability = (entry: string): string =>
  entry.trim().toUpperCase().replace(CAP_PREFIX, "");

export const noPrivilegedService: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      if (isComposeTrue(config.privileged)) {
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

      const { cap_add: capAdd } = config;

      if (!isComposeSequence(capAdd)) {
        continue;
      }

      for (const [index, entry] of capAdd.entries()) {
        if (isComposeString(entry) && normalizeCapability(entry) === "ALL") {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Service '${name}' adds every Linux capability with cap_add '${entry.trim()}'. That grants the kernel powers of privileged mode, so compromising this service compromises the host.`,
              this.help,
              context?.locate?.(["services", name, "cap_add", index])
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Remove `privileged: true` and `cap_add: [ALL]`, and grant the narrowest specific capability the service needs. `ALL` and `SYS_ADMIN` work like privileged mode. Use `devices` for individual device access.",
  key: "docker-doctor/no-privileged-service",
  message: "Do not run services in privileged mode",
};

const HOST_NAMESPACE_EFFECTS = new Map([
  ["cgroup", "the container sees the host's whole cgroup tree, not its own."],
  ["ipc", "the container shares the host's shared memory and message queues."],
  ["pid", "the container can see and signal every process on the host."],
  [
    "userns_mode",
    "root in the container is root on the host, because user namespace remapping is off.",
  ],
  ["uts", "the container shares the host's hostname and domain name."],
]);

export const noHostNamespaces: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      for (const [key, value] of Object.entries(config)) {
        const effect = HOST_NAMESPACE_EFFECTS.get(key);

        if (
          effect !== undefined &&
          isComposeString(value) &&
          value.trim().toLowerCase() === "host"
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Service '${name}' sets '${key}: host', so ${effect}`,
              this.help,
              context?.locate?.(["services", name, key])
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Remove the key so the service gets its own namespace. If `ipc: host` is there for shared memory, as PyTorch and vLLM often need, set `shm_size` instead.",
  key: "docker-doctor/no-host-namespaces",
  message:
    "Do not share the host PID, IPC, UTS, cgroup or user namespace with services",
};

const CAPABILITY_RISKS = new Map([
  [
    "DAC_READ_SEARCH",
    "lets it read any file on the host it can name by handle, whatever the permissions",
  ],
  ["SYS_ADMIN", "lets it mount filesystems and reach most of the kernel"],
  ["SYS_MODULE", "lets it load code into the host kernel"],
  ["SYS_RAWIO", "lets it read and write the host's raw I/O ports and memory"],
]);

const SECURITY_OPT_RISKS = new Map([
  ["apparmor:unconfined", "turns off the AppArmor profile"],
  ["label:disable", "turns off SELinux separation"],
  ["seccomp:unconfined", "turns off the syscall filter"],
  [
    "systempaths:unconfined",
    "unmasks the /proc and /sys paths Docker hides by default",
  ],
]);

// Docker reads `seccomp=unconfined` and `seccomp:unconfined` alike.
const normalizeSecurityOpt = (entry: string): string =>
  entry.trim().toLowerCase().replace("=", ":");

const CONFINEMENT_SETTINGS = [
  {
    field: "cap_add",
    normalize: normalizeCapability,
    risks: CAPABILITY_RISKS,
  },
  {
    field: "security_opt",
    normalize: normalizeSecurityOpt,
    risks: SECURITY_OPT_RISKS,
  },
] as const;

export const noWeakenedConfinement: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      for (const { field, normalize, risks } of CONFINEMENT_SETTINGS) {
        const entries = config[field];

        if (!isComposeSequence(entries)) {
          continue;
        }

        for (const [index, entry] of entries.entries()) {
          if (!isComposeString(entry)) {
            continue;
          }

          const risk = risks.get(normalize(entry));

          if (risk !== undefined) {
            diagnostics.push(
              createDiagnostic(
                file,
                this.key,
                this.defaultSeverity,
                `Service '${name}' sets ${field} '${entry.trim()}', which ${risk}.`,
                this.help,
                context?.locate?.(["services", name, field, index])
              )
            );
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Remove the capability or the `security_opt` entry. If the service needs one specific thing, grant that instead, such as a single device in `devices`.",
  key: "docker-doctor/no-weakened-confinement",
  message: "Do not weaken container confinement",
};

const SOCKET_PROXY_REGISTRIES = new Set([
  "docker.io",
  "ghcr.io",
  "index.docker.io",
  "lscr.io",
]);

const SOCKET_PROXY_REPOSITORIES = new Set([
  "linuxserver/socket-proxy",
  "tecnativa/docker-socket-proxy",
  "wollomatic/socket-proxy",
]);

const isSocketProxy = (config: ComposeMapping): boolean => {
  const { build, image } = config;

  if (build !== undefined || !isComposeString(image)) {
    return false;
  }

  const parsed = parseComposeImage(image);

  return (
    parsed !== undefined &&
    (parsed.registry === undefined ||
      SOCKET_PROXY_REGISTRIES.has(parsed.registry)) &&
    SOCKET_PROXY_REPOSITORIES.has(parsed.repository)
  );
};

export const noDockerSocketMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      if (isComposeTrue(config.use_api_socket)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' sets use_api_socket. Compose mounts the Docker socket into this container and copies your registry credentials into it, so anything running there can control the Docker daemon and push or pull as you.`,
            this.help,
            context?.locate?.(["services", name, "use_api_socket"])
          )
        );
      }

      const { volumes } = config;

      if (!isComposeSequence(volumes) || isSocketProxy(config)) {
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
  help: "Prefer a filtering socket proxy that allows only the API calls the service needs, and do not publish the service's port. use_api_socket is the same socket plus your registry credentials, so it is not a safer option.",
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

interface BroadMount {
  reason: string;
  source: string;
}

// The host path a bind mount exposes and why that is too broad, or null for
// a narrow mount, the Docker socket or anything that is not a bind mount.
const broadBindMount = (volume: ComposeValue): BroadMount | null => {
  const mount = volumeMount(volume);

  if (!mount || mountsDockerSocket(mount)) {
    return null;
  }

  const source = bindMountSource(mount);

  if (source === undefined || isReadOnlyExemptHostPath(mount, source)) {
    return null;
  }

  const reason = BROAD_SCOPE_REASONS[classifyHostPath(source)];

  return reason === undefined ? null : { reason, source };
};

// The host path of a writable bind mount outside the project, or null.
const writableHostPath = (volume: ComposeValue): string | null => {
  const mount = volumeMount(volume);

  if (!mount || mount.readOnly || mountsDockerSocket(mount)) {
    return null;
  }

  const source = bindMountSource(mount);

  return source === undefined || classifyHostPath(source) === "project"
    ? null
    : source;
};

export const noBroadBindMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { volumes } = config;

      if (!isComposeSequence(volumes)) {
        continue;
      }

      for (const [index, volume] of volumes.entries()) {
        const broad = broadBindMount(volume);

        if (broad !== null) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Service '${name}' bind-mounts '${broad.source}', ${broad.reason}. Everything under it is readable by the container, and a writable mount is the foothold for VM-escape bugs.`,
              this.help,
              context?.locate?.(["services", name, "volumes", index])
            )
          );
        }
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

      if (!isComposeSequence(volumes)) {
        continue;
      }

      for (const [index, volume] of volumes.entries()) {
        const source = writableHostPath(volume);

        if (source !== null) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Service '${name}' bind-mounts host path '${source}' read-write. A writable host mount lets the container change files outside the project, and is the foothold for VM-escape bugs.`,
              this.help,
              context?.locate?.(["services", name, "volumes", index])
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Append `:ro` to the short syntax, or set `read_only: true` in the long syntax, unless the service must write to the host path.",
  key: "docker-doctor/prefer-read-only-bind-mount",
  message: "Bind mounts outside the project should be read-only",
};

// YAML reads an unquoted `123456` as a number, and it is still a literal
// value in the file. Booleans are left out: `AUTH_ENABLED: true` matches the
// `auth` key pattern but holds no secret.
const literalValue = (value: ComposeValue | undefined): string | undefined => {
  if (isComposeString(value)) {
    return value;
  }

  if (isComposeNumber(value)) {
    return String(value);
  }

  return undefined;
};

const isSecretAssignment = (key: string, value: string): boolean =>
  containsProviderToken(value) ||
  (isSecretKey(key) && isLiteralSecretValue(value));

// The key of a "KEY=value" list entry whose value is a literal secret, or
// null. A bare "KEY" passes the host value through and holds no literal.
const listEntrySecretKey = (entry: ComposeValue): string | null => {
  if (!isComposeString(entry)) {
    return null;
  }

  const eqIndex = entry.indexOf("=");

  if (eqIndex <= 0) {
    return null;
  }

  const key = entry.slice(0, eqIndex);
  const value = entry.slice(eqIndex + 1);

  return isSecretAssignment(key, value) ? key : null;
};

const isMappingSecret = (
  key: string,
  value: ComposeValue | undefined
): boolean => {
  const literal = literalValue(value);

  return literal !== undefined && isSecretAssignment(key, literal);
};

interface SecretEntry {
  key: string;
  position: string | number;
}

// The entries of an `environment` or `build.args` block that hold a literal
// secret, in list or mapping form.
const secretEntries = (block: ComposeValue | undefined): SecretEntry[] => {
  const entries: SecretEntry[] = [];

  if (isComposeSequence(block)) {
    for (const [index, entry] of block.entries()) {
      const key = listEntrySecretKey(entry);

      if (key !== null) {
        entries.push({ key, position: index });
      }
    }
  } else if (isComposeMapping(block)) {
    for (const [key, value] of Object.entries(block)) {
      if (isMappingSecret(key, value)) {
        entries.push({ key, position: key });
      }
    }
  }

  return entries;
};

const BUILD_ARG_SECRET_HELP =
  "Pass the value as a Compose `secrets:` entry and read it in the Dockerfile with `RUN --mount=type=secret`.";

export const noPlaintextSecrets: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { build, environment } = config;
      const buildArgs = isComposeMapping(build) ? build.args : undefined;

      for (const { key, position } of secretEntries(environment)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Potential secret in service '${name}' environment: '${key}'. A literal value here lives in version control in plain text.`,
            this.help,
            context?.locate?.(["services", name, "environment", position])
          )
        );
      }

      for (const { key, position } of secretEntries(buildArgs)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Potential secret in service '${name}' build args: '${key}'. A build arg stays in the image history, so anyone who can pull the image can read it.`,
            BUILD_ARG_SECRET_HELP,
            context?.locate?.(["services", name, "build", "args", position])
          )
        );
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
  noHostNamespaces,
  noWeakenedConfinement,
  noDockerSocketMount,
  noBroadBindMount,
  preferReadOnlyBindMount,
  noPlaintextSecrets,
];
