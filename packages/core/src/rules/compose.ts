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

export const composeRules = [
  noVersionKey,
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
];
