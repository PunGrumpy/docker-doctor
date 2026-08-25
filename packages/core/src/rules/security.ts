import {
  collectStageAliases,
  isScratch,
  parseFromArgs,
  parseImageRef,
} from "../parsers/image-ref";
import type { Diagnostic, DockerfileRule } from "../types/index";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });

// USER accepts "user", "uid", "user:group" and "uid:gid". Only the user half
// decides whether the container runs as root; the group half is irrelevant.
const isRootUser = (value: string): boolean => {
  const [user] = value.split(":");
  return user === "root" || user === "0";
};

export const noRootUser: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    // A stage built FROM a previous stage inherits that stage's image
    // config, USER included; a fresh base image resets it to root.
    const stageUser = new Map<string, string>();
    let currentStage: string | null = null;
    let lastUser = "root";
    let lastUserLine = 1;

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const { base, stage } = parseFromArgs(inst.args);
        lastUser = stageUser.get(base?.toLowerCase() ?? "") ?? "root";
        lastUserLine = inst.line;
        currentStage = stage?.toLowerCase() ?? null;
        if (currentStage) {
          stageUser.set(currentStage, lastUser);
        }
      } else if (inst.instruction === "USER") {
        lastUser = inst.args.trim().toLowerCase();
        lastUserLine = inst.line;
        if (currentStage) {
          stageUser.set(currentStage, lastUser);
        }
      }
    }

    if (isRootUser(lastUser)) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity as "error" | "warning" | "info",
          "The container runs as root. Running as root allows potential container breakout vulnerabilities.",
          this.help,
          lastUserLine
        ),
      ];
    }

    return [];
  },
  defaultSeverity: "warning",
  help: "Add a non-root user (e.g., `USER node` or `USER 1000`) to improve security.",
  key: "docker-doctor/no-root-user",
  message: "Run the container as a non-root user",
};

export const noSecretsInEnv: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    const secretKeywords = [
      /(?:^|[_-])password(?:[_-]|$)/iu,
      /(?:^|[_-])secret(?:[_-]|$)/iu,
      /(?:^|[_-])token(?:[_-]|$)/iu,
      /(?:^|[_-])api_key(?:[_-]|$)/iu,
      /(?:^|[_-])private_key(?:[_-]|$)/iu,
      /(?:^|[_-])auth(?:[_-]|$)/iu,
    ];

    for (const inst of instructions) {
      if (inst.instruction === "ENV" || inst.instruction === "ARG") {
        const args = inst.args.trim();
        if (inst.instruction === "ENV" && !args.includes("=")) {
          // KEY VALUE format
          const match = args.match(/^(?<key>[^\s]+)\s+(?<value>.*)$/u);
          if (match?.groups) {
            const { key, value } = match.groups;
            const isSecretKey = secretKeywords.some((regex) => regex.test(key));
            if (
              isSecretKey &&
              value &&
              !value.startsWith("$") &&
              !value.startsWith("{")
            ) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  `Potential secret found in ${inst.instruction}: '${key}'. Secrets baked into images can be extracted easily by anyone with image access.`,
                  this.help,
                  inst.line
                )
              );
            }
          }
        } else {
          // Existing KEY=VALUE logic
          const parts = args.split(/\s+/u);
          for (const part of parts) {
            const eqIndex = part.indexOf("=");
            let key = "";
            let value = "";

            if (eqIndex > 0) {
              key = part.slice(0, eqIndex);
              value = part.slice(eqIndex + 1);
            } else {
              key = part;
            }

            const isSecretKey = secretKeywords.some((regex) => regex.test(key));
            if (
              isSecretKey &&
              value &&
              !value.startsWith("$") &&
              !value.startsWith("{")
            ) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  `Potential secret found in ${inst.instruction}: '${key}'. Secrets baked into images can be extracted easily by anyone with image access.`,
                  this.help,
                  inst.line
                )
              );
            }
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Use Docker Secrets, build arguments passed at runtime, or environment variables at runtime instead of baking them into the image.",
  key: "docker-doctor/no-secrets-in-env",
  message: "Avoid storing secrets in ENV or ARG instructions",
};

export const pinImageVersion: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    const stageAliases = collectStageAliases(instructions);

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        // FROM image or FROM image:tag or FROM image@sha256:hash
        // Also respect multi-stage builds (AS stageName)
        const imagePart = parseFromArgs(inst.args).base;

        if (!imagePart || isScratch(imagePart)) {
          continue;
        }

        const ref = parseImageRef(imagePart);

        if (ref.isVariable || stageAliases.has(imagePart.toLowerCase())) {
          continue;
        }

        if (!(ref.tag || ref.digest)) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Base image '${imagePart}' does not specify a tag. This makes builds non-deterministic.`,
              this.help,
              inst.line
            )
          );
        } else if (ref.tag === "latest" && !ref.digest) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Base image '${imagePart}' uses the mutable 'latest' tag. This makes builds non-deterministic.`,
              this.help,
              inst.line
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Specify a concrete tag instead of `latest` or no tag (e.g., `node:22.2.0-alpine` instead of `node`).",
  key: "docker-doctor/pin-image-version",
  message: "Pin base images to a specific tag or digest",
};

export const noAddRemote: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const src = parts.find((p) => !p.startsWith("--"));

        if (!src) {
          continue;
        }

        if (src.startsWith("http://") || src.startsWith("https://")) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `ADD instruction uses a remote URL '${src}'. Remote files added via ADD cannot be cleaned up in later layers, increasing image size.`,
              this.help,
              inst.line
            )
          );
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Use `RUN curl` or `RUN wget` instead of ADD for remote URLs, and delete the downloaded archive in the same layer to minimize size.",
  key: "docker-doctor/no-add-remote",
  message: "Avoid using ADD with remote URLs",
};

export const securityRules = [
  noRootUser,
  noSecretsInEnv,
  pinImageVersion,
  noAddRemote,
];
