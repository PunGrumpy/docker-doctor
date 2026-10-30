import { stripRunFlags } from "../parsers/run-flags";
import { maskQuotedText } from "../parsers/shell-quotes";
import { hasText } from "../text";
import type { Diagnostic, DockerfileRule } from "../types/index";
import { createDiagnostic } from "./create-diagnostic";

const BUILD_SCRIPTS = [
  "npm run build",
  "yarn build",
  "bun run build",
  "cargo build",
];

const COPY_ALL_SOURCES = new Set([".", "", "*", "src"]);

const INSTALL_COMMANDS = [
  "npm install",
  "npm ci",
  "yarn install",
  "bun install",
  "pip install",
  "cargo fetch",
];

const PIP_INSTALL_RE = /pip install(?<pipArgs>.*)/isu;
const NO_DEPS_FLAGS = new Set(["--no-deps", "--no-dependencies"]);
const SHELL_SEPARATOR_RE = /&&|\|\||[;|]/gu;
const WHITESPACE_RE = /\s+/u;
const QUOTE_RE = /["']/gu;
const LEADING_DOT_SLASH_RE = /^\.\//u;

// `pip`, `setuptools` and `wheel`, each with an optional version specifier.
const PIP_TOOLING_RE = /^(?:pip|setuptools|wheel)(?:[=<>!~]\S*)?$/iu;

// `.`, `..`, `./pkg`, `../pkg` and `/app`, each with optional `[extras]`.
const LOCAL_PATH_RE = /^(?:\.{1,2}(?:\[[^\]]*\])?|(?:\.{1,2})?\/\S*)$/u;

// The commands of a RUN, split at `&&`, `||`, `;` and `|` outside quotes.
const shellCommands = (args: string): string[] => {
  const commands: string[] = [];
  let start = 0;

  for (const match of maskQuotedText(args).matchAll(SHELL_SEPARATOR_RE)) {
    commands.push(args.slice(start, match.index));
    start = match.index + match[0].length;
  }

  commands.push(args.slice(start));

  return commands;
};

const matchedInstallCommands = (command: string): string[] => {
  const lowered = command.toLowerCase();

  return INSTALL_COMMANDS.filter((install) => lowered.includes(install));
};

// `-r ./requirements.txt` looks like a local path but lists packages to download.
const isRequirementsOption = (word: string): boolean =>
  word === "--requirement" ||
  word.startsWith("--requirement=") ||
  (word.startsWith("-r") && !word.startsWith("--"));

// The words after `pip install`, or undefined when the command is not a
// plain `pip install` (it also runs another install command).
const pipInstallWords = (command: string): string[] | undefined => {
  const pipArgs = PIP_INSTALL_RE.exec(command)?.groups?.pipArgs;

  if (pipArgs === undefined || matchedInstallCommands(command).length !== 1) {
    return undefined;
  }

  return pipArgs.split(WHITESPACE_RE).filter(Boolean);
};

const pipTargets = (words: string[]): string[] =>
  words.flatMap((word) =>
    word.startsWith("-") ? [] : [word.replace(QUOTE_RE, "")]
  );

// `pip install .` and `pip install -e ".[dev]"` install the project that was
// just copied, so they cannot move above the copy. They fetch nothing new
// when the dependencies were installed earlier or the command skips them
// with `--no-deps`. Any other target (a package, a URL, `-r file`) is a
// download that can move.
const installsOnlyTheProject = (
  command: string,
  dependenciesInstalled: boolean
): boolean => {
  const words = pipInstallWords(command);

  if (words === undefined) {
    return false;
  }

  const targets = pipTargets(words);

  const targetsOnlyLocalPaths =
    targets.length > 0 &&
    targets.every((target) => LOCAL_PATH_RE.test(target)) &&
    !words.some(isRequirementsOption);

  return (
    targetsOnlyLocalPaths &&
    (dependenciesInstalled || words.some((word) => NO_DEPS_FLAGS.has(word)))
  );
};

// `pip install --upgrade pip` and the like install no project dependency.
const installsOnlyPipTooling = (command: string): boolean => {
  const words = pipInstallWords(command);

  if (words === undefined) {
    return false;
  }

  const targets = pipTargets(words);

  return (
    targets.length > 0 &&
    targets.every((target) => PIP_TOOLING_RE.test(target)) &&
    !words.some(isRequirementsOption)
  );
};

// Whether the RUN is a pip install of something other than pip's own tooling.
// Only that fills the cached layer a later `pip install .` reuses: an upgrade
// of pip installs no dependency, and `npm ci` caches nothing for Python.
const installsPipDependencies = (args: string): boolean =>
  shellCommands(args).some(
    (command) =>
      PIP_INSTALL_RE.test(command) && !installsOnlyPipTooling(command)
  );

// A COPY or ADD of the whole build context or of `src/`.
const copiesAllSource = (args: string): boolean => {
  const src = args.split(WHITESPACE_RE).find((part) => !part.startsWith("--"));

  if (!hasText(src)) {
    return false;
  }

  const normalized = src.replace(LEADING_DOT_SLASH_RE, "");

  return COPY_ALL_SOURCES.has(normalized) || normalized.startsWith("src/");
};

// Whether the RUN downloads packages that the copy before it makes the build
// fetch again.
const refetchesPackages = (
  args: string,
  dependenciesInstalled: boolean
): boolean =>
  shellCommands(args)
    .filter((command) => matchedInstallCommands(command).length > 0)
    .some((command) => !installsOnlyTheProject(command, dependenciesInstalled));

// `make` only where a command can start, so `apk add make` (installing the
// tool) is not a build step while `cd src && make` is.
const BUILD_TOOL_COMMAND_RE =
  /(?:^|&&|\|\||;|\||\(|`|\$\()\s*(?:make|cmake)(?=\s|$)/u;

// A build script or a build tool command, whose toolchain a single-stage
// image would ship.
const runsBuild = (args: string): boolean =>
  BUILD_SCRIPTS.some((script) => args.includes(script)) ||
  BUILD_TOOL_COMMAND_RE.test(maskQuotedText(stripRunFlags(args)));

export const useMultiStage: DockerfileRule = {
  category: "Performance",
  check(instructions, file) {
    const fromCount = instructions.filter(
      (inst) => inst.instruction === "FROM"
    ).length;

    if (fromCount === 1) {
      const hasBuildSteps = instructions.some(
        (inst) => inst.instruction === "RUN" && runsBuild(inst.args)
      );

      if (hasBuildSteps) {
        return [
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            "Only one build stage (FROM) was detected, but build instructions were found. Multi-stage builds can significantly reduce final image size.",
            this.help,
            (instructions.find((inst) => inst.instruction === "FROM")?.line ??
              0) ||
              1
          ),
        ];
      }
    }

    return [];
  },
  defaultSeverity: "info",
  help: "Use multi-stage builds (multiple FROM statements) to separate build dependencies from the runtime image and reduce size.",
  key: "docker-doctor/use-multi-stage",
  message: "Use multi-stage builds",
};

export const orderLayers: DockerfileRule = {
  category: "Performance",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    let copyAllLine = -1;
    let installedBeforeCopy = false;

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        copyAllLine = -1;
        installedBeforeCopy = false;
      }

      const copiesSource =
        inst.instruction === "COPY" || inst.instruction === "ADD";

      if (copiesSource && copyAllLine === -1 && copiesAllSource(inst.args)) {
        copyAllLine = inst.line;
      }

      if (inst.instruction === "RUN") {
        if (copyAllLine === -1) {
          installedBeforeCopy ||= installsPipDependencies(inst.args);
        } else if (refetchesPackages(inst.args, installedBeforeCopy)) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
              this.defaultSeverity,
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
          this.defaultSeverity,
          `Found ${consecutiveRunCount} consecutive RUN instructions starting at line ${firstRunLine}. Consider combining them into a single RUN layer.`,
          this.help,
          firstRunLine
        )
      );
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Combine consecutive RUN instructions using `&&` and `\\` to reduce the total layer count and image size.",
  key: "docker-doctor/minimize-layers",
  message: "Minimize the number of image layers",
};

// Docker reads .dockerignore from the build-context root, which we cannot know
// statically. Accept the locations that cover real usage: next to the
// Dockerfile, at the scan root (the common monorepo-root build context), or
// BuildKit's per-Dockerfile `<Dockerfile>.dockerignore`, which it prefers
// when building with `-f`. Paths here are scan-root-relative and always
// "/"-separated.
const hasDockerignoreFor = (
  dockerfilePath: string,
  projectFiles: string[]
): boolean => {
  const lastSlash = dockerfilePath.lastIndexOf("/");
  const dir = lastSlash === -1 ? "" : dockerfilePath.slice(0, lastSlash);
  const adjacent = dir === "" ? ".dockerignore" : `${dir}/.dockerignore`;
  const perDockerfile = `${dockerfilePath}.dockerignore`;

  return projectFiles.some(
    (f) => f === adjacent || f === perDockerfile || f === ".dockerignore"
  );
};

export const useDockerignore: DockerfileRule = {
  category: "Performance",
  check(instructions, file, context) {
    const hasCopyAll = instructions.some((inst) => {
      if (inst.instruction === "COPY" || inst.instruction === "ADD") {
        // COPY --from=<stage> reads from a previous build stage, not the
        // build context, so .dockerignore is irrelevant to it.
        const isStageCopy = /(?:^|\s)--from=/u.test(inst.args);

        if (isStageCopy) {
          return false;
        }

        const parts = inst.args.split(/\s+/u);
        const src = parts.find((p) => !p.startsWith("--"));

        if (!hasText(src)) {
          return false;
        }

        return src === "." || src === "./" || src === "*";
      }

      return false;
    });

    if (
      hasCopyAll &&
      context?.projectFiles &&
      !hasDockerignoreFor(file, context.projectFiles)
    ) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          "Using COPY/ADD with a wildcard or directory, but no .dockerignore file was found next to the Dockerfile or at the project root. This can copy local build folders and secrets.",
          this.help,
          1
        ),
      ];
    }

    return [];
  },
  defaultSeverity: "warning",
  help: "Create a .dockerignore file in the same directory as the Dockerfile to prevent copying unnecessary files (like node_modules, logs, build artifacts).",
  key: "docker-doctor/use-dockerignore",
  message: "Add a .dockerignore file",
};

export const performanceRules = [
  useMultiStage,
  orderLayers,
  minimizeLayers,
  useDockerignore,
];
