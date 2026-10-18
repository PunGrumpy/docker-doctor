import {
  composeField,
  isComposeMapping,
  isComposeSequence,
  isComposeString,
} from "../parsers/compose-value";
import { mutableRefIssue, parseImageRef } from "../parsers/image-ref";
import type { ComposeRule, Diagnostic } from "../types/index";
import { composeServices } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";

export const noVersionKey: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    if (isComposeMapping(composeContent) && "version" in composeContent) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          "The 'version' property is deprecated. Remove it to use standard Compose spec behavior.",
          this.help,
          context?.locate?.(["version"])
        ),
      ];
    }
    return [];
  },
  defaultSeverity: "warning",
  help: "The `version` key is obsolete in the Compose specification. Omitting it defaults to the latest specification.",
  key: "docker-doctor/no-version-key",
  message: "Remove the `version` key from the Compose file",
};

export const requireResourceLimits: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const limits = composeField(
        composeField(config.deploy, "resources"),
        "limits"
      );
      const hasDeployLimits = [
        composeField(limits, "cpus"),
        composeField(limits, "memory"),
      ].some(Boolean);
      // Pre-`deploy` spelling of the same limits, still in the spec.
      const hasServiceLevelLimits = [
        config.mem_limit,
        config.cpus,
        config.cpu_quota,
      ].some(Boolean);

      if (!(hasDeployLimits || hasServiceLevelLimits)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' does not have CPU or memory limits defined. A resource leak in this service could crash the host.`,
            this.help,
            context?.locate?.(["services", name])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Add resource limits (e.g. `deploy.resources.limits`) to prevent a single service from starving host resources in production.",
  key: "docker-doctor/require-resource-limits",
  message: "Define resource limits for services",
};

export const requireRestartPolicy: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const hasRestart = "restart" in config;
      const hasDeployRestart =
        composeField(config.deploy, "restart_policy") !== undefined;

      if (!hasRestart && !hasDeployRestart) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' has no restart policy configured. It will not restart if it crashes or if the host reboots.`,
            this.help,
            context?.locate?.(["services", name])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Define `restart: always` or `restart: unless-stopped` (or `deploy.restart_policy`) so services restart on crashes or host reboot.",
  key: "docker-doctor/require-restart-policy",
  message: "Set restart policy for services",
};

export const useDependsOnCondition: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      if (isComposeSequence(config.depends_on)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Service '${name}' uses shorthand depends_on list. This only checks if containers are started, not if they are ready/healthy.`,
            this.help,
            context?.locate?.(["services", name, "depends_on"]) ??
              context?.locate?.(["services", name])
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Instead of a simple service list, use `depends_on: { dependency: { condition: service_healthy } }` to ensure dependencies are fully ready before starting.",
  key: "docker-doctor/use-depends-on-condition",
  message: "Use long-form depends_on with healthcheck conditions",
};

export const pinServiceImage: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const [name, config] of composeServices(composeContent)) {
      const { image } = config;
      // With `build:` present, `image` only names the locally built
      // artifact — there is nothing to pin.
      if (!isComposeString(image) || "build" in config) {
        continue;
      }

      const ref = parseImageRef(image);
      if (ref.isVariable) {
        continue;
      }

      const issue = mutableRefIssue(ref);
      if (!issue) {
        continue;
      }
      const detail =
        issue === "untagged"
          ? `Service '${name}' image '${image}' does not specify a tag.`
          : `Service '${name}' image '${image}' uses the mutable 'latest' tag.`;
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          `${detail} Every pull may fetch a different image.`,
          this.help,
          context?.locate?.(["services", name, "image"])
        )
      );
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Pin the image to a specific tag or digest (e.g. `nginx:1.27-alpine`) so deploys are reproducible and a rollback actually rolls back.",
  key: "docker-doctor/pin-service-image",
  message: "Pin service images to a specific tag or digest",
};

export const composeRules = [
  noVersionKey,
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
  pinServiceImage,
];
