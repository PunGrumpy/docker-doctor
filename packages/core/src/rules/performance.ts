import type { Diagnostic, DockerfileRule } from "../types/index";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });

export const useMultiStage: DockerfileRule = {
  category: "Performance",
  check(instructions, file) {
    const fromCount = instructions.filter(
      (inst) => inst.instruction === "FROM"
    ).length;
    if (fromCount === 1) {
      // Check if it's not a trivial/short Dockerfile (e.g., has some build steps)
      const hasBuildSteps = instructions.some(
        (inst) =>
          inst.instruction === "RUN" &&
          (inst.args.includes("npm run build") ||
            inst.args.includes("yarn build") ||
            inst.args.includes("bun run build") ||
            inst.args.includes("cargo build") ||
            inst.args.includes("make"))
      );

      if (hasBuildSteps) {
        return [
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            "Only one build stage (FROM) was detected, but build instructions were found. Multi-stage builds can significantly reduce final image size.",
            this.help,
            instructions.find((inst) => inst.instruction === "FROM")?.line || 1
          ),
        ];
      }
    }
    return [];
  },
  defaultSeverity: "info",
  help: "Use multi-stage builds (multiple FROM statements) to separate build dependencies from the runtime image and reduce size.",
  key: "docker-doctor/use-multi-stage",
  message: "Consider using multi-stage builds",
};

export const orderLayers: DockerfileRule = {
  category: "Performance",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    let copyAllLine = -1;

    for (const inst of instructions) {
      if (inst.instruction === "COPY" || inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const src = parts.find((p) => !p.startsWith("--"));

        if (!src) {
          continue;
        }

        if (
          (src === "." || src === "./" || src === "*" || src.includes("src")) &&
          copyAllLine === -1
        ) {
          copyAllLine = inst.line;
        }
      }

      if (inst.instruction === "RUN" && copyAllLine !== -1) {
        const args = inst.args.toLowerCase();
        if (
          args.includes("npm install") ||
          args.includes("npm ci") ||
          args.includes("yarn install") ||
          args.includes("bun install") ||
          args.includes("pip install") ||
          args.includes("cargo fetch")
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Running package installation command '${inst.args}' after copying application files (at line ${copyAllLine}). This invalidates the cache on any code changes.`,
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
  help: "Copy dependency definition files (like package.json, lockfiles) and run install commands BEFORE copying the rest of the application source code.",
  key: "docker-doctor/order-layers",
  message: "Order layers to maximize build cache utility",
};

export const minimizeLayers: DockerfileRule = {
  category: "Performance",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    let consecutiveRunCount = 0;
    let firstRunLine = -1;

    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        if (consecutiveRunCount === 0) {
          firstRunLine = inst.line;
        }
        consecutiveRunCount += 1;
      } else {
        if (consecutiveRunCount > 2) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `Found ${consecutiveRunCount} consecutive RUN instructions starting at line ${firstRunLine}. Consider combining them into a single RUN layer.`,
              this.help,
              firstRunLine
            )
          );
        }
        consecutiveRunCount = 0;
      }
    }

    if (consecutiveRunCount > 2) {
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity as "error" | "warning" | "info",
          `Found ${consecutiveRunCount} consecutive RUN instructions starting at line ${firstRunLine}. Consider combining them into a single RUN layer.`,
          this.help,
          firstRunLine
        )
      );
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Combine consecutive RUN instructions using '&&' and '\\' to reduce the total layer count and image size.",
  key: "docker-doctor/minimize-layers",
  message: "Minimize the number of image layers",
};

export const useDockerignore: DockerfileRule = {
  category: "Performance",
  check(instructions, file, context) {
    // If copying everything, we definitely need .dockerignore
    const hasCopyAll = instructions.some((inst) => {
      if (inst.instruction === "COPY" || inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const [src] = parts;
        return src === "." || src === "./" || src === "*";
      }
      return false;
    });

    if (hasCopyAll && context?.projectFiles) {
      const hasDockerignore = context.projectFiles.some((f) =>
        f.endsWith(".dockerignore")
      );
      if (!hasDockerignore) {
        return [
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            "Using COPY/ADD with wildcard/directory, but no .dockerignore file was found in the workspace. This can copy local build folders and secrets.",
            this.help,
            1
          ),
        ];
      }
    }
    return [];
  },
  defaultSeverity: "warning",
  help: "Create a .dockerignore file in the same directory as the Dockerfile to prevent copying unnecessary files (like node_modules, logs, build artifacts).",
  key: "docker-doctor/use-dockerignore",
  message: "Ensure .dockerignore is used",
};

export const performanceRules = [
  useMultiStage,
  orderLayers,
  minimizeLayers,
  useDockerignore,
];
