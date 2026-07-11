import type { Diagnostic, DockerfileRule } from "../types/index.js";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });

export const noRootUser: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    let lastUser = "root";
    let lastUserLine = 1;

    for (const inst of instructions) {
      if (inst.instruction === "USER") {
        lastUser = inst.args.trim().toLowerCase();
        lastUserLine = inst.line;
      }
    }

    if (lastUser === "root" || lastUser === "0" || lastUser === "0:0") {
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
  help: "Add a non-root user (e.g., 'USER node' or 'USER 1000') to improve security.",
  key: "docker-doctor/no-root-user",
  message: "Container should not run as root user",
};

export const noSecretsInEnv: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    const secretKeywords = [
      /password/iu,
      /secret/iu,
      /token/iu,
      /api_key/iu,
      /private_key/iu,
      /auth/iu,
    ];

    for (const inst of instructions) {
      if (inst.instruction === "ENV" || inst.instruction === "ARG") {
        const parts = inst.args.split(/\s+/u);
        // ENV can be KEY=VALUE or KEY VALUE
        for (const part of parts) {
          const eqIndex = part.indexOf("=");
          let key = "";
          let value = "";

          if (eqIndex > 0) {
            key = part.slice(0, eqIndex);
            value = part.slice(eqIndex + 1);
          } else {
            // Might be ENV KEY VALUE
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

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Use Docker Secrets, build arguments passed at runtime, or environment variables at runtime instead of baking them into the image.",
  key: "docker-doctor/no-secrets-in-env",
  message: "Do not store secrets in ENV or ARG instructions",
};

export const pinImageVersion: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        // FROM image or FROM image:tag or FROM image@sha256:hash
        // Also respect multi-stage builds (AS stageName)
        const parts = inst.args.split(/\s+/u);
        const imagePart = parts.find((p) => !p.startsWith("--"));

        if (!imagePart || imagePart === "scratch") {
          continue;
        }

        const colonIndex = imagePart.indexOf(":");
        const atIndex = imagePart.indexOf("@");

        if (colonIndex === -1 && atIndex === -1) {
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
        } else if (colonIndex !== -1) {
          const tag = imagePart.slice(colonIndex + 1);
          if (tag === "latest") {
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
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Specify a concrete tag instead of 'latest' or no tag (e.g., 'node:22.2.0-alpine' instead of 'node').",
  key: "docker-doctor/pin-image-version",
  message: "Always pin base image versions to specific tags",
};

export const noAddRemote: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const [src] = parts;

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
  help: "Use 'RUN curl' or 'RUN wget' instead of ADD for remote URLs, and delete the downloaded archive in the same layer to minimize size.",
  key: "docker-doctor/no-add-remote",
  message: "Avoid using ADD with remote URLs",
};

export const securityRules = [
  noRootUser,
  noSecretsInEnv,
  pinImageVersion,
  noAddRemote,
];
