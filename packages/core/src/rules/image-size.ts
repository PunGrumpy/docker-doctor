import {
  collectStageAliases,
  isHardenedImage,
  isScratch,
  parseFromArgs,
  parseImageRef,
} from "../parsers/image-ref";
import { stripRunFlags } from "../parsers/run-flags";
import { maskQuotedText } from "../parsers/shell-quotes";
import type {
  Diagnostic,
  DockerfileInstruction,
  DockerfileRule,
} from "../types/index";
import { createDiagnostic } from "./create-diagnostic";
import { hasAptGetInstall } from "./package-managers";

interface StageRun {
  inst: DockerfileInstruction;
  // True when the RUN executes with NODE_ENV=production.
  productionEnv: boolean;
}

interface BuildStage {
  base: string;
  from: DockerfileInstruction;
  name: string | null;
  runs: StageRun[];
}

// `ENV NODE_ENV=production` and the legacy `ENV NODE_ENV production`, quoted
// or not, anywhere in a multi-variable ENV.
const NODE_ENV_ASSIGNMENT_RE =
  /(?:^|\s)NODE_ENV(?:=|\s+)["']?(?<value>[^\s"']*)/u;

// `ARG NODE_ENV` or `ARG NODE_ENV=production`, quoted or not, anywhere in a
// multi-variable ARG.
const NODE_ENV_ARG_RE =
  /(?:^|\s)NODE_ENV(?:=["']?(?<value>[^\s"']*)["']?)?(?=\s|$)/u;

// `ENV NODE_ENV=${NODE_ENV}` copies the build argument into the environment.
const NODE_ENV_REFERENCE_RE = /^\$(?:NODE_ENV|\{NODE_ENV\})$/u;

interface NodeEnvState {
  // The default of `ARG NODE_ENV` in this stage, if declared.
  arg: string | undefined;
  // The value of `ENV NODE_ENV` in this stage, if set.
  env: string | undefined;
}

// RUN sees both ENV and ARG values. ENV takes precedence over an ARG of the
// same name.
const currentNodeEnv = (state: NodeEnvState): string | undefined =>
  state.env ?? state.arg;

// An `ARG NODE_ENV` with no default of its own takes the default of the ARG
// declared before the first FROM.
const applyNodeEnv = (
  inst: DockerfileInstruction,
  state: NodeEnvState,
  globalArg: string | undefined
): void => {
  if (inst.instruction === "ARG") {
    const match = NODE_ENV_ARG_RE.exec(inst.args);
    if (match) {
      state.arg = match.groups?.value ?? globalArg;
    }
  } else if (inst.instruction === "ENV") {
    const value = NODE_ENV_ASSIGNMENT_RE.exec(inst.args)?.groups?.value;
    if (value !== undefined) {
      state.env = NODE_ENV_REFERENCE_RE.test(value)
        ? currentNodeEnv(state)
        : value;
    }
  }
};

const collectStages = (instructions: DockerfileInstruction[]): BuildStage[] => {
  const stages: BuildStage[] = [];
  // A stage built FROM this one inherits its ENV and its ARGs.
  const nodeEnv: NodeEnvState[] = [];
  // An ARG before the first FROM is not visible inside a stage.
  const globalScope: NodeEnvState = { arg: undefined, env: undefined };
  for (const inst of instructions) {
    const state = nodeEnv.at(-1) ?? globalScope;
    if (inst.instruction === "FROM") {
      const { base, stage } = parseFromArgs(inst.args);
      const baseKey = base?.toLowerCase() ?? "";
      const parent = stages.findIndex(
        (s) => s.name !== null && s.name === baseKey
      );
      nodeEnv.push(
        parent === -1
          ? { arg: undefined, env: undefined }
          : { ...nodeEnv[parent] }
      );
      stages.push({
        base: baseKey,
        from: inst,
        name: stage?.toLowerCase() ?? null,
        runs: [],
      });
    } else if (inst.instruction === "RUN") {
      stages.at(-1)?.runs.push({
        inst,
        productionEnv: currentNodeEnv(state) === "production",
      });
    } else {
      applyNodeEnv(inst, state, globalScope.arg);
    }
  }
  return stages;
};

// The default build target is the last stage, and its image contains every
// layer of the local stages it builds FROM. Every other stage is discarded.
const shippedStages = (stages: BuildStage[]): BuildStage[] => {
  const shipped: BuildStage[] = [];
  let index = stages.length - 1;
  while (index >= 0) {
    shipped.unshift(stages[index]);
    const { base } = stages[index];
    index = stages
      .slice(0, index)
      .findIndex((s) => s.name !== null && s.name === base);
  }
  return shipped;
};

// Minimal bases identify themselves either in the name (alpine, busybox,
// gcr.io/distroless/*, cgr.dev/chainguard/*) or in the tag (node:22-slim,
// runtime-deps:8.0-jammy-chiseled). Judging by tag alone flagged
// `alpine:3.19`.
const MINIMAL_BASE_MARKERS = [
  "alpine",
  "slim",
  "distroless",
  "busybox",
  "chainguard",
  "wolfi",
  "chiseled",
  "minideb",
  "nanoserver",
] as const;

// Short words that only count as a whole name or tag segment: `ubi-minimal`,
// `ubi-micro` and `amazonlinux:2023-minimal`, but not `microsoft/dotnet`.
const MINIMAL_BASE_SEGMENT_RE = /(?:^|[/_. -])(?:minimal|micro)(?:$|[/_. -])/u;

export const preferSlimBase: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    const stageAliases = collectStageAliases(instructions);

    // A build stage that is discarded never reaches the image, so its base
    // has no effect on the image's size.
    for (const { from } of shippedStages(collectStages(instructions))) {
      const imagePart = parseFromArgs(from.args).base;
      if (!imagePart || isScratch(imagePart)) {
        continue;
      }

      const ref = parseImageRef(imagePart);

      if (ref.isVariable || stageAliases.has(imagePart.toLowerCase())) {
        continue;
      }

      // Docker Hardened Images are minimal by construction (dev variants
      // included), whatever their name and tag say.
      if (isHardenedImage(imagePart)) {
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

      const haystack = `${ref.name} ${ref.tag}`.toLowerCase();
      const isSlim =
        MINIMAL_BASE_MARKERS.some((marker) => haystack.includes(marker)) ||
        MINIMAL_BASE_SEGMENT_RE.test(haystack);

      if (!isSlim) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `Base image '${imagePart}' may be a full-OS distribution. Consider using a slim or alpine alternative.`,
            this.help,
            from.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "info",
  help: "Prefer tags with `-slim`, `-alpine`, or use distroless base images to minimize the default operating system footprint.",
  key: "docker-doctor/prefer-slim-base",
  message: "Prefer slim, alpine, or distroless base images",
};

const BUILDKIT_MOUNT_FLAG_RE = /--mount=(?<spec>\S+)/gu;

// BuildKit accepts `target`, `dst` and `destination` as synonyms.
const CACHE_TARGET_KEY_RE = /^(?:target|dst|destination)=/u;

// A `RUN --mount=type=cache,target=<dir>` keeps <dir> in the cache mount, not
// in the image layer — cleanup commands for that dir are unnecessary (and the
// Docker-documented apt pattern deliberately omits them).
const cacheMountTargets = (args: string): string[] =>
  [...args.matchAll(BUILDKIT_MOUNT_FLAG_RE)]
    .map((match) => (match.groups?.spec ?? "").split(","))
    .filter((options) => options.includes("type=cache"))
    .flatMap((options) =>
      options
        .filter((option) => CACHE_TARGET_KEY_RE.test(option))
        .map((option) => option.slice(option.indexOf("=") + 1))
    );

// A recursive `rm` and its operands, which end at the next shell separator.
// `rm -rf`, `rm -fr`, `rm -r` and `rm -Rf` all count.
const RECURSIVE_RM_RE =
  /\brm\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*[rR][A-Za-z]*\s(?<operands>[^;&|]*)/gu;

// `rm -rf /tmp/* <dir>/*` removes <dir> as much as `rm -rf <dir>/*` does.
const removesRecursively = (args: string, dir: string): boolean =>
  [...args.matchAll(RECURSIVE_RM_RE)].some((match) =>
    (match.groups?.operands ?? "").includes(dir)
  );

const APT_CACHE_DIRS = ["/var/lib/apt", "/var/cache/apt"];
const APK_CACHE_DIRS = ["/var/cache/apk", "/etc/apk/cache"];

const hasCacheMountFor = (args: string, cacheDirs: string[]): boolean =>
  cacheMountTargets(args).some((target) =>
    cacheDirs.some((dir) => target === dir || target.startsWith(`${dir}/`))
  );

export const cleanPackageCache: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const { args } = inst;

        // check apt-get install without cleanup
        if (
          hasAptGetInstall(args) &&
          !removesRecursively(args, "/var/lib/apt/lists") &&
          !hasCacheMountFor(args, APT_CACHE_DIRS)
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
          !removesRecursively(args, "/var/cache/apk") &&
          !hasCacheMountFor(args, APK_CACHE_DIRS)
        ) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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

const SHELL_SEPARATOR_RE = /\s*(?:&&|\|\||;|\|)\s*/u;
const WHITESPACE_RE = /\s+/u;
const ENV_ASSIGNMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*=/u;
const NODE_PACKAGE_MANAGERS = new Set(["npm", "yarn", "pnpm", "bun"]);
// The managers that leave devDependencies out when NODE_ENV is
// "production". Bun and pnpm 10 and later ignore it. Yarn 2 and later
// ignore it too, but a Dockerfile rarely says which Yarn it runs, so
// `yarn` keeps the Yarn 1 behavior.
const MANAGERS_HONORING_NODE_ENV = new Set(["npm", "yarn"]);
const INSTALL_VERBS = new Set(["install", "ci", "i"]);
// Flags that mean the install leaves devDependencies out of the image.
// `-g`/`--global` install a tool instead of the project, `-P` is pnpm's
// production flag and `-p` is bun's.
const NON_DEV_INSTALL_FLAGS = new Set([
  "-g",
  "--global",
  "--production",
  "--production=true",
  "--omit=dev",
  "--only=prod",
  "--only=production",
  "--prod",
  "-P",
  "-p",
]);

// One shell command, e.g. `NODE_ENV=production npm ci --omit=dev`. Only a
// bare project install counts: a positional word after the verb
// (`npm install express`) installs named packages, not devDependencies.
const segmentInstallsDevDependencies = (
  segment: string,
  productionEnv: boolean
): boolean => {
  const tokens = segment.split(WHITESPACE_RE).filter(Boolean);
  const commandStart = tokens.findIndex(
    (token) => !ENV_ASSIGNMENT_RE.test(token)
  );
  if (commandStart === -1) {
    return false;
  }
  const [manager, verb, ...options] = tokens.slice(commandStart);
  if (!(NODE_PACKAGE_MANAGERS.has(manager) && INSTALL_VERBS.has(verb))) {
    return false;
  }
  const skipsDevDependencies =
    MANAGERS_HONORING_NODE_ENV.has(manager) &&
    (productionEnv ||
      tokens.slice(0, commandStart).includes("NODE_ENV=production"));
  return (
    !skipsDevDependencies &&
    options.every(
      (option) => option.startsWith("-") && !NON_DEV_INSTALL_FLAGS.has(option)
    )
  );
};

const installsDevDependencies = ({ inst, productionEnv }: StageRun): boolean =>
  !inst.args.includes("prune") &&
  maskQuotedText(stripRunFlags(inst.args))
    .split(SHELL_SEPARATOR_RE)
    .some((segment) => segmentInstallsDevDependencies(segment, productionEnv));

export const avoidDevDependencies: DockerfileRule = {
  category: "Image Size",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    const stages = collectStages(instructions);
    const finalStage = stages.at(-1);

    // A dev install in an inherited stage ships just like one in the final
    // stage itself.
    for (const stage of shippedStages(stages)) {
      for (const run of stage.runs) {
        if (!installsDevDependencies(run)) {
          continue;
        }
        const { inst } = run;
        const where =
          stage === finalStage
            ? "in the final stage"
            : `in stage '${stage.name}', whose layers the final stage inherits,`;
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
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
