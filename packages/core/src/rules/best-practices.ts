import type { Diagnostic, DockerfileRule } from "../types/index";

const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: "error" | "warning" | "info",
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });

export const requireHealthcheck: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const hasHealthcheck = instructions.some(
      (inst) => inst.instruction === "HEALTHCHECK"
    );

    // Only suggest healthcheck if it has exposed ports or command lines indicating it runs an app
    const hasExposedPortsOrEntry = instructions.some(
      (inst) =>
        inst.instruction === "EXPOSE" ||
        inst.instruction === "CMD" ||
        inst.instruction === "ENTRYPOINT"
    );

    if (!hasHealthcheck && hasExposedPortsOrEntry) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity as "error" | "warning" | "info",
          "No HEALTHCHECK instruction found. Containers running services should expose healthchecks to enable auto-healing.",
          this.help,
          1
        ),
      ];
    }
    return [];
  },
  defaultSeverity: "info",
  help: "Use HEALTHCHECK (e.g., 'HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1') so Docker can monitor the container's live status.",
  key: "docker-doctor/require-healthcheck",
  message: "Add a HEALTHCHECK instruction",
};

export const preferCopyOverAdd: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const src = parts.find((p) => !p.startsWith("--"));

        if (!src) {
          continue;
        }

        // If it's not a remote url (handled by security/no-add-remote) and not a compressed file
        const isRemote =
          src.startsWith("http://") || src.startsWith("https://");
        const isArchive =
          src.endsWith(".tar") ||
          src.endsWith(".tar.gz") ||
          src.endsWith(".tgz") ||
          src.endsWith(".zip");

        if (!isRemote && !isArchive) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `ADD instruction used for regular files: '${inst.args}'. COPY is simpler and less prone to magic side effects.`,
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
  help: "Use COPY instead of ADD unless you explicitly need auto-extraction of local compressed archives (tar, zip, etc.).",
  key: "docker-doctor/prefer-copy-over-add",
  message: "Prefer COPY over ADD",
};

export const useExecForm: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "CMD" || inst.instruction === "ENTRYPOINT") {
        const args = inst.args.trim();
        // If it does not start with [ and end with ]
        if (!args.startsWith("[") || !args.endsWith("]")) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `${inst.instruction} instruction uses shell form instead of exec form. In shell form, the command runs under '/bin/sh -c', which does not pass signals to child processes.`,
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
  help: 'Write CMD/ENTRYPOINT instructions as JSON arrays (e.g. ENTRYPOINT ["node", "index.js"]) so OS signals (like SIGTERM) are forwarded correctly.',
  key: "docker-doctor/use-exec-form",
  message: "Use exec form for CMD and ENTRYPOINT",
};

export const requireLabels: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const hasLabel = instructions.some((inst) => inst.instruction === "LABEL");
    if (!hasLabel) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity as "error" | "warning" | "info",
          "No LABEL metadata was found in this Dockerfile. Adding labels helps identify build information, maintainers, and descriptions.",
          this.help,
          1
        ),
      ];
    }
    return [];
  },
  defaultSeverity: "info",
  help: 'Use LABEL instructions (e.g. LABEL org.opencontainers.image.authors="...") to document ownership, license, version, and build info.',
  key: "docker-doctor/require-labels",
  message: "Add LABEL metadata to images",
};

export const combineAptUpdateInstall: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const hasUpdate = inst.args.includes("apt-get update");
        const hasInstall = inst.args.includes("apt-get install");

        if (hasUpdate && !hasInstall) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              "RUN apt-get update used without apt-get install in the same instruction. This can cause caching issues and build failures.",
              this.help,
              inst.line
            )
          );
        } else if (hasInstall && !hasUpdate) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              "RUN apt-get install used without apt-get update in the same instruction. Always combine them to ensure up-to-date package installation.",
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
  help: "Combine 'apt-get update' and 'apt-get install' in the same RUN instruction (e.g. 'RUN apt-get update && apt-get install -y --no-install-recommends <package> && rm -rf /var/lib/apt/lists/*').",
  key: "docker-doctor/combine-apt-update-install",
  message: "Combine apt-get update and apt-get install",
};

export const usePipefail: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const { raw } = inst;
        const hasPipe = /(?<!\|)\|(?!\|)/u.test(raw);
        if (hasPipe && !raw.includes("pipefail")) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              "RUN instruction uses a pipe (|) but does not configure 'pipefail'. If a command in the pipe fails, the step may still succeed silently.",
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
  help: "Prepend 'set -o pipefail &&' to pipe commands, or use exec form with a shell that supports it (e.g., RUN ['/bin/bash', '-c', 'set -o pipefail && ...']).",
  key: "docker-doctor/use-pipefail",
  message: "Use pipefail to catch pipeline command failures",
};

export const absoluteWorkdir: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "WORKDIR") {
        const path = inst.args.trim();
        const isAbsolute = /^(?:\/|\\|\$|[a-zA-Z]:)/u.test(path);

        if (!isAbsolute) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity as "error" | "warning" | "info",
              `WORKDIR specifies a relative path '${path}'. For clarity and reliability, always use absolute paths.`,
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
  help: "Always specify absolute paths for WORKDIR instructions (e.g. WORKDIR /app).",
  key: "docker-doctor/absolute-workdir",
  message: "Use absolute paths for WORKDIR",
};

export const avoidRunCd: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "RUN" && /\bcd\b/u.test(inst.args)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            "Avoid using 'cd' in RUN instructions. Use WORKDIR instead to change the working directory stably across layers.",
            this.help,
            inst.line
          )
        );
      }
    }
    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Use the WORKDIR instruction instead of 'cd' inside RUN to establish directory context.",
  key: "docker-doctor/avoid-run-cd",
  message: "Avoid changing directories with cd in RUN",
};

export const sortMultilineArgs: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const { raw } = inst;
        const isPackageInstall =
          raw.includes("apt-get install") ||
          raw.includes("apk add") ||
          raw.includes("yum install") ||
          raw.includes("dnf install");

        const hasContinuation = raw.includes("\\\n") || raw.includes("\\\r\n");

        if (isPackageInstall && hasContinuation) {
          const lines = raw.split(/\r?\n/u);
          const packages = lines
            .slice(1)
            .map((line) => line.trim())
            .filter(
              (line) =>
                line !== "" &&
                !line.startsWith("&&") &&
                !line.startsWith("-") &&
                !line.includes("rm -rf")
            )
            .map((line) =>
              line.endsWith("\\") ? line.slice(0, -1).trim() : line
            )
            .filter(Boolean);

          if (packages.length > 1) {
            const sorted = packages.toSorted((a, b) => a.localeCompare(b));
            const isSorted = packages.every((val, idx) => val === sorted[idx]);
            if (!isSorted) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity as "error" | "warning" | "info",
                  "Multi-line package arguments are not sorted alphanumerically. Keeping them sorted makes maintenance easier and prevents duplicates.",
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
  defaultSeverity: "info",
  help: "Sort multi-line package installation lists (e.g. apk/apt package lists) alphabetically.",
  key: "docker-doctor/sort-multiline-args",
  message: "Sort multi-line arguments alphanumerically",
};

export const useraddNoLogInit: DockerfileRule = {
  category: "Best Practices",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    for (const inst of instructions) {
      if (
        inst.instruction === "RUN" &&
        /\buseradd\b/u.test(inst.args) &&
        !inst.args.includes("--no-log-init")
      ) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity as "error" | "warning" | "info",
            "RUN instruction runs 'useradd' without '--no-log-init'. This can cause excessive disk space usage / exhaustion under Go's sparse tar archive bug when large UIDs are used.",
            this.help,
            inst.line
          )
        );
      }
    }
    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Pass '--no-log-init' flag to useradd (e.g., 'RUN useradd --no-log-init -r -g mygroup myuser').",
  key: "docker-doctor/useradd-no-log-init",
  message: "Use --no-log-init with useradd",
};

export const bestPracticesRules = [
  requireHealthcheck,
  preferCopyOverAdd,
  useExecForm,
  requireLabels,
  combineAptUpdateInstall,
  usePipefail,
  absoluteWorkdir,
  avoidRunCd,
  sortMultilineArgs,
  useraddNoLogInit,
];
