import {
  collectStageAliases,
  isScratch,
  parseFromArgs,
  parseImageRef,
} from "../parsers/image-ref";
import type {
  Diagnostic,
  DockerfileInstruction,
  DockerfileRule,
} from "../types/index";

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
    const stageAliases = collectStageAliases(instructions);

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const imagePart = parseFromArgs(inst.args).base;
        if (!imagePart || isScratch(imagePart)) {
          continue;
        }

        const ref = parseImageRef(imagePart);

        if (ref.isVariable || stageAliases.has(imagePart.toLowerCase())) {
          continue;
        }

        // Digest pins are already fully deterministic; not our concern here.
        if (ref.digest) {
          continue;
        }

        // No tag: pin-image-version owns the untagged case, don't double-report.
        if (!ref.tag) {
          continue;
        }

        // Minimal bases identify themselves either in the name (alpine,
        // busybox, gcr.io/distroless/*) or in the tag (node:22-slim,
        // python:3.13-alpine). Judging by tag alone flagged `alpine:3.19`.
        const haystack = `${ref.name} ${ref.tag}`.toLowerCase();
        const isSlim =
          haystack.includes("alpine") ||
          haystack.includes("slim") ||
          haystack.includes("distroless") ||
          haystack.includes("busybox");

        if (!isSlim) {
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

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Prefer tags with `-slim`, `-alpine`, or use distroless base images to minimize the default operating system footprint.",
  key: "docker-doctor/prefer-slim-base",
  message: "Prefer slim, alpine, or distroless base images",
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
  help: "For apt-get, append `&& rm -rf /var/lib/apt/lists/*`. For apk, use `apk add --no-cache`. For dnf/yum, run `yum clean all`.",
  key: "docker-doctor/clean-package-cache",
  message: "Clean up package manager cache in the same RUN layer",
};

const installsDevDependencies = (args: string): boolean =>
  (args.includes("npm install") ||
    args.includes("npm ci") ||
    args.includes("yarn install")) &&
  !args.includes("--production") &&
  !args.includes("--omit=dev") &&
  !args.includes("prune");

export const avoidDevDependencies: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    const stages: {
      name: string | null;
      base: string;
      runs: DockerfileInstruction[];
    }[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const { base, stage } = parseFromArgs(inst.args);
        stages.push({
          base: base?.toLowerCase() ?? "",
          name: stage?.toLowerCase() ?? null,
          runs: [],
        });
      } else if (inst.instruction === "RUN" && stages.length > 0) {
        stages.at(-1)?.runs.push(inst);
      }
    }
    if (stages.length === 0) {
      return diagnostics;
    }

    // The default build target is the last stage, and its image contains
    // every layer of the local stages it builds FROM — so a dev install in
    // an inherited stage ships just like one in the final stage itself.
    const auditedIndices: number[] = [];
    let index = stages.length - 1;
    while (index >= 0) {
      auditedIndices.push(index);
      const { base } = stages[index];
      index = stages
        .slice(0, index)
        .findIndex((s) => s.name !== null && s.name === base);
    }

    const finalIndex = stages.length - 1;
    for (const stageIndex of auditedIndices.toReversed()) {
      const stage = stages[stageIndex];
      for (const inst of stage.runs) {
        if (!installsDevDependencies(inst.args)) {
          continue;
        }
        const where =
          stageIndex === finalIndex
            ? "in the final stage"
            : `in stage '${stage.name}', whose layers the final stage inherits,`;
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            `Running package install '${inst.args}' ${where} without omitting devDependencies.`,
            this.help,
            inst.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "For Node.js, run `npm prune --production` or install only production dependencies (`npm ci --omit=dev`) in the runtime stage.",
  key: "docker-doctor/avoid-dev-dependencies",
  message: "Avoid installing dev dependencies in the final stage",
};

export const imageSizeRules = [
  preferSlimBase,
  cleanPackageCache,
  avoidDevDependencies,
];
