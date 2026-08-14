import { parseImageRef } from "../parsers/image-ref";
import type { Diagnostic, ComposeRule } from "../types/index";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string
): Diagnostic => ({ file, help, message, rule: ruleKey, severity });

export const noVersionKey: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    if (
      composeContent &&
      typeof composeContent === "object" &&
      "version" in composeContent
    ) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity as "error" | "warning" | "info",
          "The 'version' property is deprecated. Remove it to use standard Compose spec behavior.",
          this.help
        ),
      ];
    }
    return [];
  },
  defaultSeverity: "warning",
  help: "The 'version' key is deprecated by the Compose specification. Omitting it defaults to the latest specification.",
  key: "docker-doctor/no-version-key",
  message: "Remove the 'version' key from Compose file",
};

export const requireResourceLimits: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    if (
      composeContent &&
      typeof composeContent === "object" &&
      "services" in composeContent
    ) {
      const { services } = composeContent;
      if (services && typeof services === "object") {
        for (const [name, config] of Object.entries(services)) {
          if (config && typeof config === "object") {
            const deploy = (config as Record<string, unknown>).deploy as
              | Record<string, unknown>
              | undefined;
            const resources = deploy?.resources as
              | Record<string, unknown>
              | undefined;
            const limits = resources?.limits as
              | Record<string, unknown>
              | undefined;

            if (!limits || (!limits.cpus && !limits.memory)) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  `Service '${name}' does not have CPU or memory limits defined. A resource leak in this service could crash the host.`,
                  this.help
                )
              );
            }
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Add resource limits (e.g. deploy.resources.limits) to prevent a single service from starving host resources in production.",
  key: "docker-doctor/require-resource-limits",
  message: "Define resource limits for services",
};

export const requireRestartPolicy: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    if (
      composeContent &&
      typeof composeContent === "object" &&
      "services" in composeContent
    ) {
      const { services } = composeContent;
      if (services && typeof services === "object") {
        for (const [name, config] of Object.entries(services)) {
          if (config && typeof config === "object") {
            const hasRestart = "restart" in config;
            const deploy = (config as Record<string, unknown>).deploy as
              | Record<string, unknown>
              | undefined;
            const hasDeployRestart = deploy?.restart_policy !== undefined;

            if (!hasRestart && !hasDeployRestart) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  `Service '${name}' has no restart policy configured. It will not restart if it crashes or if the host reboots.`,
                  this.help
                )
              );
            }
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Define 'restart: always' or 'restart: unless-stopped' (or deploy.restart_policy) so services restart on crashes or host reboot.",
  key: "docker-doctor/require-restart-policy",
  message: "Set restart policy for services",
};

export const useDependsOnCondition: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    if (
      composeContent &&
      typeof composeContent === "object" &&
      "services" in composeContent
    ) {
      const { services } = composeContent;
      if (services && typeof services === "object") {
        for (const [name, config] of Object.entries(services)) {
          if (config && typeof config === "object") {
            const dependsOn = (config as Record<string, unknown>).depends_on;
            if (dependsOn && Array.isArray(dependsOn)) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  `Service '${name}' uses shorthand depends_on list. This only checks if containers are started, not if they are ready/healthy.`,
                  this.help
                )
              );
            }
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Instead of a simple service list, use 'depends_on: { dependency: { condition: service_healthy } }' to ensure dependencies are fully ready before starting.",
  key: "docker-doctor/use-depends-on-condition",
  message: "Use long-form depends_on with healthcheck conditions",
};

type Service = Record<string, unknown>;

const eachService = (composeContent: unknown): [string, Service][] => {
  if (
    !composeContent ||
    typeof composeContent !== "object" ||
    !("services" in composeContent)
  ) {
    return [];
  }

  const { services } = composeContent;

  if (!services || typeof services !== "object") {
    return [];
  }

  return Object.entries(services).filter(
    (entry): entry is [string, Service] =>
      Boolean(entry[1]) && typeof entry[1] === "object"
  );
};

export const noPrivileged: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of eachService(composeContent)) {
      if (config.privileged === true) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' runs privileged. The container gets all kernel capabilities and access to host devices, so escaping it is escaping to the host.`,
            this.help
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Drop 'privileged: true' and grant only the capabilities the service actually needs with 'cap_add', or mount the specific device it needs with 'devices'.",
  key: "docker-doctor/no-privileged",
  message: "Do not run services in privileged mode",
};

export const noHostNetwork: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of eachService(composeContent)) {
      if (config.network_mode === "host") {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' uses host networking. It shares the host network stack, so every port it opens is published on the host and network isolation between services is gone.`,
            this.help
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Remove 'network_mode: host' and publish only the ports you need with 'ports', binding to 127.0.0.1 when the service is not meant to be reachable from outside the machine.",
  key: "docker-doctor/no-host-network",
  message: "Avoid host network mode",
};

const DOCKER_SOCKET = "/var/run/docker.sock";

const mountsDockerSocket = (volume: unknown): boolean => {
  if (typeof volume === "string") {
    return volume.split(":")[0] === DOCKER_SOCKET;
  }

  if (volume && typeof volume === "object") {
    return (volume as Record<string, unknown>).source === DOCKER_SOCKET;
  }

  return false;
};

export const noDockerSocketMount: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of eachService(composeContent)) {
      const { volumes } = config;

      if (Array.isArray(volumes) && volumes.some(mountsDockerSocket)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' mounts the Docker socket. Anything that can talk to that socket can start a privileged container on the host, which makes this equivalent to giving the service root.`,
            this.help
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Remove the '/var/run/docker.sock' mount. If the service genuinely needs to drive Docker, put a socket proxy in front of it that exposes only the endpoints it uses, or mount it read-only in a dedicated, isolated service.",
  key: "docker-doctor/no-docker-socket-mount",
  message: "Do not mount the Docker socket into services",
};

const SECRET_KEY_PATTERNS = [
  /(?:^|[_-])password(?:[_-]|$)/iu,
  /(?:^|[_-])secret(?:[_-]|$)/iu,
  /(?:^|[_-])token(?:[_-]|$)/iu,
  /(?:^|[_-])api_key(?:[_-]|$)/iu,
  /(?:^|[_-])private_key(?:[_-]|$)/iu,
];

const INTERPOLATED_VALUE = /^\$\{?[A-Za-z_]/u;

const isLiteralSecret = (rawKey: string, rawValue: unknown): boolean => {
  if (!SECRET_KEY_PATTERNS.some((pattern) => pattern.test(rawKey))) {
    return false;
  }

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return false;
  }

  return !INTERPOLATED_VALUE.test(String(rawValue));
};

const literalSecretKeys = (environment: unknown): string[] => {
  if (Array.isArray(environment)) {
    return environment
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => {
        const eqIndex = entry.indexOf("=");
        return eqIndex > 0
          ? ([entry.slice(0, eqIndex), entry.slice(eqIndex + 1)] as const)
          : ([entry, undefined] as const);
      })
      .filter(([entryKey, value]) => isLiteralSecret(entryKey, value))
      .map(([entryKey]) => entryKey);
  }

  if (environment && typeof environment === "object") {
    return Object.entries(environment)
      .filter(([entryKey, value]) => isLiteralSecret(entryKey, value))
      .map(([entryKey]) => entryKey);
  }

  return [];
};

export const noSecretsInComposeEnv: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of eachService(composeContent)) {
      const keys = literalSecretKeys(config.environment);

      for (const secretKey of keys) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' sets '${secretKey}' to a literal value. The Compose file is committed, so the credential is in version control and in 'docker inspect' output.`,
            this.help
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  // oxlint-disable-next-line eslint/no-template-curly-in-string -- Compose interpolation quoted verbatim, not a JS template literal.
  help: "Reference the value instead of inlining it: '${DB_PASSWORD}' resolved from an untracked .env file, or a Compose secret mounted as a file with the 'secrets' key.",
  key: "docker-doctor/no-secrets-in-compose-env",
  message: "Do not hardcode secrets in service environment values",
};

export const pinServiceImage: ComposeRule = {
  category: "Compose",
  check(composeContent, file) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of eachService(composeContent)) {
      const { image } = config;

      if (typeof image !== "string" || image === "") {
        continue;
      }

      const ref = parseImageRef(image);

      if (ref.isVariable || ref.digest) {
        continue;
      }

      if (!ref.tag) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' uses image '${image}' with no tag, which resolves to 'latest'. Two machines running this file can end up on different images.`,
            this.help
          )
        );
      } else if (ref.tag === "latest") {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Service '${name}' uses the mutable 'latest' tag. Two machines running this file can end up on different images.`,
            this.help
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Pin the service image to a concrete tag (e.g. 'postgres:17.2-alpine'), or to a digest when the deployment has to be byte-for-byte reproducible.",
  key: "docker-doctor/pin-service-image",
  message: "Pin service images to specific tags",
};

export const composeRules = [
  noVersionKey,
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
  noPrivileged,
  noHostNetwork,
  noDockerSocketMount,
  noSecretsInComposeEnv,
  pinServiceImage,
];
