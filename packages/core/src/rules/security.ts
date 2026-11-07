import {
  collectStageAliases,
  isDistrolessNonroot,
  isHardenedRuntimeImage,
  isScratch,
  mutableRefIssue,
  parseFromArgs,
  parseImageRef,
} from "../parsers/image-ref";
import { hasText } from "../text";
import type {
  Diagnostic,
  DockerfileInstruction,
  DockerfileRule,
} from "../types/index";
import { createDiagnostic } from "./create-diagnostic";
import {
  containsProviderToken,
  holdsUrlPassword,
  isLiteralSecretValue,
  isSecretKey,
} from "./secret-keywords";

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

        // DHI runtime bases and distroless `:nonroot` tags default to a
        // nonroot user. "nonroot" is a sentinel that isRootUser treats as
        // safe until a USER overrides it.
        const baseDefaultUser =
          hasText(base) &&
          (isHardenedRuntimeImage(base) || isDistrolessNonroot(base))
            ? "nonroot"
            : "root";

        lastUser = stageUser.get(base?.toLowerCase() ?? "") ?? baseDefaultUser;
        lastUserLine = inst.line;
        currentStage = stage?.toLowerCase() ?? null;

        if (hasText(currentStage)) {
          stageUser.set(currentStage, lastUser);
        }
      } else if (inst.instruction === "USER") {
        lastUser = inst.args.trim().toLowerCase();
        lastUserLine = inst.line;

        if (hasText(currentStage)) {
          stageUser.set(currentStage, lastUser);
        }
      }
    }

    if (isRootUser(lastUser)) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
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

// A literal value, not a `{...}` placeholder, under a key that names a secret.
const isLiteralSecretUnderKey = (key: string, value: string): boolean =>
  isSecretKey(key) && isLiteralSecretValue(value) && !value.startsWith("{");

// A token-shaped value or a URL with a literal password under any key, or a
// literal value under a key that names a secret.
const isLiteralSecret = (key: string, value: string): boolean =>
  containsProviderToken(value) ||
  holdsUrlPassword(key, value) ||
  isLiteralSecretUnderKey(key, value);

const secretKeysIn = (instruction: string, rawArgs: string): string[] => {
  const args = rawArgs.trim();

  if (instruction === "ENV" && !args.includes("=")) {
    const groups = /^(?<key>\S+)\s+(?<value>(?:\S.*)?)$/u.exec(args)?.groups;

    return groups !== undefined && isLiteralSecret(groups.key, groups.value)
      ? [groups.key]
      : [];
  }

  return args.split(/\s+/u).flatMap((part) => {
    const eqIndex = part.indexOf("=");
    const key = eqIndex > 0 ? part.slice(0, eqIndex) : part;
    const value = eqIndex > 0 ? part.slice(eqIndex + 1) : "";

    return isLiteralSecret(key, value) ? [key] : [];
  });
};

export const noSecretsInEnv: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "ENV" || inst.instruction === "ARG") {
        for (const key of secretKeysIn(inst.instruction, inst.args)) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `Potential secret found in ${inst.instruction}: '${key}'. Secrets baked into images can be extracted easily by anyone with image access.`,
              this.help,
              inst.line
            )
          );
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

// What is wrong with how a FROM pins its base image. Undefined when it is
// pinned, scratch, a variable, or an earlier stage of the same file.
const basePinIssue = (
  imagePart: string,
  instructions: DockerfileInstruction[],
  line: number
): ReturnType<typeof mutableRefIssue> => {
  const ref = parseImageRef(imagePart);

  const isStage = collectStageAliases(instructions, line).has(
    imagePart.toLowerCase()
  );

  return isScratch(imagePart) || ref.isVariable || isStage
    ? undefined
    : mutableRefIssue(ref);
};

export const pinImageVersion: DockerfileRule = {
  category: "Security",
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const imagePart = parseFromArgs(inst.args).base;

        const issue = hasText(imagePart)
          ? basePinIssue(imagePart, instructions, inst.line)
          : undefined;

        if (issue !== undefined) {
          const detail =
            issue === "untagged"
              ? `Base image '${imagePart}' does not specify a tag.`
              : `Base image '${imagePart}' uses the mutable 'latest' tag.`;

          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
              `${detail} This makes builds non-deterministic.`,
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
        // BuildKit verifies a download when ADD has `--checksum`, the form
        // Docker's guidance recommends for remote artifacts.
        const isVerified = parts.some((p) => p.startsWith("--checksum="));

        if (!hasText(src) || isVerified) {
          continue;
        }

        if (src.startsWith("http://") || src.startsWith("https://")) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
  help: "Add `--checksum=sha256:<digest>` so BuildKit verifies the download, or use `RUN curl` or `RUN wget` and delete the downloaded archive in the same layer to minimize size.",
  key: "docker-doctor/no-add-remote",
  message: "Avoid using ADD with remote URLs",
};

const TRUSTED_FRONTEND_REGISTRIES = new Set(["docker.io", "index.docker.io"]);

const TRUSTED_FRONTEND_REPOSITORIES = new Set([
  "docker/dockerfile",
  "docker/dockerfile-upstream",
]);

// BuildKit keeps a quoted or escaped space inside a flag and then drops the
// quotes.
const RUN_FLAG_TOKEN = /(?:"[^"]*"|'[^']*'|\\.|[^\s"'])+/gu;
const QUOTE = /["']/gu;
const WHITESPACE = /\s/u;

const UNSAFE_RUN_FLAGS = new Set(["--network=host", "--security=insecure"]);

// BuildKit reads the frontend image up to the first space, and passes the
// rest to the frontend as options.
const isTrustedFrontend = (value: string): boolean => {
  const [image = ""] = value.split(WHITESPACE, 1);
  const { digest, name, registry } = parseImageRef(image);

  return (
    digest?.startsWith("sha256:") === true ||
    ((registry === undefined || TRUSTED_FRONTEND_REGISTRIES.has(registry)) &&
      TRUSTED_FRONTEND_REPOSITORIES.has(name))
  );
};

const unsafeRunFlags = (args: string): string[] => {
  const flags: string[] = [];

  for (const [token] of args.matchAll(RUN_FLAG_TOKEN)) {
    const flag = token.replaceAll(QUOTE, "").toLowerCase();

    if (flag === "--" || !flag.startsWith("--")) {
      break;
    }

    if (UNSAFE_RUN_FLAGS.has(flag)) {
      flags.push(flag);
    }
  }

  return flags;
};

export const noUnsafeBuildFeatures: DockerfileRule = {
  category: "Security",
  check(instructions, file, context) {
    const diagnostics: Diagnostic[] = [];
    const syntax = context?.directives?.syntax;

    if (syntax !== undefined && !isTrustedFrontend(syntax.value)) {
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          `Dockerfile selects BuildKit frontend '${syntax.value}'. A frontend runs with access to the build, so an untrusted one can read or change what it builds.`,
          this.help,
          syntax.line
        )
      );
    }

    for (const inst of instructions) {
      if (inst.instruction !== "RUN") {
        continue;
      }

      for (const flag of unsafeRunFlags(inst.args)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `RUN uses ${flag}, which removes build isolation for this step.`,
            this.help,
            inst.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Use the official `docker/dockerfile` frontend, or pin a third-party one by digest after reviewing it. Remove --security=insecure and --network=host unless the build truly needs them.",
  key: "docker-doctor/no-unsafe-build-features",
  message: "Avoid untrusted BuildKit frontends and insecure RUN flags",
};

export const securityRules = [
  noRootUser,
  noSecretsInEnv,
  pinImageVersion,
  noAddRemote,
  noUnsafeBuildFeatures,
];
