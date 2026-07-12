import type { Diagnostic, DockerfileRule } from "../types/index";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });

export const preferSlimBase: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const parts = inst.args.split(/\s+/u);
        const imagePart = parts.find((p) => !p.startsWith("--"));
        if (!imagePart || imagePart === "scratch") {
          continue;
        }

        const colonIndex = imagePart.indexOf(":");
        if (colonIndex !== -1) {
          const tag = imagePart.slice(colonIndex + 1).toLowerCase();

          // If the tag doesn't contain alpine, slim, distroless, or sha256
          const isSlim =
            tag.includes("alpine") ||
            tag.includes("slim") ||
            tag.includes("distroless");
          const isSha = tag.startsWith("sha256:");

          // Skip if it's a multi-stage builder step reference (e.g. FROM build AS publish)
          const isStageReference = instructions.some(
            (other) =>
              other.line < inst.line &&
              other.instruction === "FROM" &&
              other.args
                .toLowerCase()
                .includes(` as ${imagePart.toLowerCase()}`)
          );

          if (!isSlim && !isSha && !isStageReference) {
            diagnostics.push(
              createDiagnostic(
                file,
                this.key,
                this.defaultSeverity as "error" | "warning" | "info",
                `Base image '${imagePart}' may be a full-OS distribution. Consider using a slim or alpine alternative.`,
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
  defaultSeverity: "info",
  help: "Prefer tags with '-slim', '-alpine', or use distroless base images to minimize the default operating system footprint.",
  key: "docker-doctor/prefer-slim-base",
  message: "Use slim, alpine, or distroless base images",
};

export const cleanPackageCache: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const { args } = inst;

        // check apt-get install without cleanup
        if (
          args.includes("apt-get install") &&
          !args.includes("rm -rf /var/lib/apt/lists")
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Running 'apt-get install' without removing package lists afterwards. This keeps metadata caches inside the image layer.`,
              this.help,
              inst.line
            )
          );
        }

        // check apk add without --no-cache
        if (
          args.includes("apk add") &&
          !args.includes("--no-cache") &&
          !args.includes("rm -rf /var/cache/apk")
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Running 'apk add' without '--no-cache' or cleaning the apk cache. This increases layer size.`,
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
  help: "For apt-get, append '&& rm -rf /var/lib/apt/lists/*'. For apk, use 'apk add --no-cache'. For dnf/yum, run 'yum clean all'.",
  key: "docker-doctor/clean-package-cache",
  message: "Clean up package manager cache in the same RUN layer",
};

export const avoidDevDependencies: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    let isLastStage = false;
    let fromCount = 0;

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        fromCount += 1;
      }
    }

    let currentStage = 0;
    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        currentStage += 1;
        isLastStage = currentStage === fromCount;
      }

      if (isLastStage && inst.instruction === "RUN") {
        const { args } = inst;
        if (
          (args.includes("npm install") ||
            args.includes("npm ci") ||
            args.includes("yarn install")) &&
          !args.includes("--production") &&
          !args.includes("--omit=dev") &&
          !args.includes("prune")
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Running package install '${inst.args}' in the final stage without omitting devDependencies.`,
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
  help: "For Node.js, run 'npm prune --production' or install only production dependencies ('npm ci --omit=dev') in the runtime stage.",
  key: "docker-doctor/avoid-dev-dependencies",
  message:
    "Avoid installing development dependencies in final production stage",
};

export const imageSizeRules = [
  preferSlimBase,
  cleanPackageCache,
  avoidDevDependencies,
];
