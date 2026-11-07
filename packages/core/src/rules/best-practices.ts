import { parseExecForm } from "../parsers/exec-form";
import { isScratch, parseFromArgs } from "../parsers/image-ref";
import { stripRunFlags } from "../parsers/run-flags";
import { maskQuotedText } from "../parsers/shell-quotes";
import { splitShellCommands, splitShellWords } from "../parsers/shell-words";
import { hasText } from "../text";
import type { Diagnostic, DockerfileRule, RuleCategory } from "../types/index";
import { createDiagnostic } from "./create-diagnostic";
import { hasAptGetInstall, hasAptGetUpdate } from "./package-managers";

const BEST_PRACTICES = "Best Practices" satisfies RuleCategory;

export const requireHealthcheck: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const hasHealthcheck = instructions.some(
      (inst) => inst.instruction === "HEALTHCHECK"
    );

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
          this.defaultSeverity,
          "No HEALTHCHECK instruction found. Containers running services should expose healthchecks to enable auto-healing.",
          this.help,
          1
        ),
      ];
    }

    return [];
  },
  defaultSeverity: "info",
  help: "Use HEALTHCHECK (e.g., `HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/ || exit 1`) so Docker can monitor the container's live status.",
  key: "docker-doctor/require-healthcheck",
  message: "Add a HEALTHCHECK instruction",
};

// ADD auto-extracts local tar archives (identity, gzip, bzip2, xz). Zip files
// are copied verbatim, so COPY is the right instruction for them.
const AUTO_EXTRACT_SUFFIXES = [
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
  ".tbz2",
  ".tbz",
  ".tar.xz",
  ".txz",
] as const;

export const preferCopyOverAdd: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "ADD") {
        const parts = inst.args.split(/\s+/u);
        const src = parts.find((p) => !p.startsWith("--"));

        if (!hasText(src)) {
          continue;
        }

        const isRemote =
          src.startsWith("http://") || src.startsWith("https://");

        const isArchive = AUTO_EXTRACT_SUFFIXES.some((suffix) =>
          src.toLowerCase().endsWith(suffix)
        );

        if (!isRemote && !isArchive) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      const takesExecForm =
        inst.instruction === "CMD" || inst.instruction === "ENTRYPOINT";

      // Bracket-wrapped args that are not a JSON string array still run under
      // /bin/sh -c, so they count as shell form.
      if (takesExecForm && parseExecForm(inst.args) === null) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            `${inst.instruction} instruction uses shell form instead of exec form. In shell form, the command runs under '/bin/sh -c', which does not pass signals to child processes.`,
            this.help,
            inst.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: 'Write CMD/ENTRYPOINT instructions as JSON arrays (e.g. `ENTRYPOINT ["node", "index.js"]`) so OS signals (like SIGTERM) are forwarded correctly.',
  key: "docker-doctor/use-exec-form",
  message: "Use exec form for CMD and ENTRYPOINT",
};

export const requireLabels: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const hasLabel = instructions.some((inst) => inst.instruction === "LABEL");

    if (!hasLabel) {
      return [
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          "No LABEL metadata was found in this Dockerfile. Adding labels helps identify build information, maintainers, and descriptions.",
          this.help,
          1
        ),
      ];
    }

    return [];
  },
  defaultSeverity: "info",
  help: 'Use LABEL instructions (e.g. `LABEL org.opencontainers.image.authors="..."`) to document ownership, license, version, and build info.',
  key: "docker-doctor/require-labels",
  message: "Add LABEL metadata to images",
};

export const combineAptUpdateInstall: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const hasUpdate = hasAptGetUpdate(inst.args);
        const hasInstall = hasAptGetInstall(inst.args);

        if (hasUpdate && !hasInstall) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
              this.defaultSeverity,
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
  help: "Combine `apt-get update` and `apt-get install` in the same RUN instruction (e.g. `RUN apt-get update && apt-get install -y --no-install-recommends <package> && rm -rf /var/lib/apt/lists/*`).",
  key: "docker-doctor/combine-apt-update-install",
  message: "Combine apt-get update and apt-get install",
};

// An actual pipefail setting: the option must appear adjacent to its flag
// (`-o pipefail`, `-euo pipefail`, repeated `-o errexit -o pipefail`, or a
// shell invoked with `-o pipefail`). Matching the flag directly (rather than
// a shell name) also works inside joined exec-form argv, and cannot backtrack
// pathologically. Known limitation: the word inside quotes (e.g.
// `echo "set -o pipefail" >> .bashrc`) still matches.
export const PIPEFAIL_SETTING_RE = /(?:^|\s)-[A-Za-z]*o\s+pipefail\b/u;

const HAS_PIPE_RE = /(?<!\|)\|(?!\|)/u;

// Shell text where a `|` is not a pipe:
// - A backslash escapes the next character, so `s/a\|b/c/` holds no pipe.
// - `$(( ))` and `${ }` hold arithmetic and parameter words.
// - A `case` pattern list ends in `)` and follows `in` or a `;;` terminator,
//   so the bar in `x86_64|amd64)` separates alternatives. `$(a|b)` has no such
//   lead, so it still reads as a pipe.
const ESCAPED_CHAR_RE = /\\[\s\S]/gu;

const CASE_PATTERN_RE = /(?:(?<![\w-])in\s|;;&?|;&)\s*\(?[^\s()&;]+\)/gu;

interface ExpansionSpan {
  close: string;
  depth: number;
  open: string;
  start: string;
}

const EXPANSION_SPANS: readonly ExpansionSpan[] = [
  { close: ")", depth: 2, open: "(", start: "$((" },
  { close: "}", depth: 1, open: "{", start: "${" },
];

// Replaces each balanced span with a space. An unterminated span runs to the
// end of the text.
const blankSpans = (text: string, span: ExpansionSpan): string => {
  let result = "";
  let index = 0;
  let found = text.indexOf(span.start, index);

  while (found !== -1) {
    result += text.slice(index, found);
    let { depth } = span;
    index = found + span.start.length;

    while (index < text.length && depth > 0) {
      if (text[index] === span.open) {
        depth += 1;
      } else if (text[index] === span.close) {
        depth -= 1;
      }

      index += 1;
    }

    result += " ";
    found = text.indexOf(span.start, index);
  }

  return result + text.slice(index);
};

const withoutNonPipeBars = (text: string): string => {
  let result = text.replace(ESCAPED_CHAR_RE, " ");

  for (const span of EXPANSION_SPANS) {
    result = blankSpans(result, span);
  }

  return result.replace(CASE_PATTERN_RE, " ");
};

// `cd` only where a command can start: line start, or after a list/pipe
// separator or a subshell open. Path segments (/opt/cd) and words never sit
// in command position.
const CD_COMMAND_RE = /(?:^|&&|\|\||;|\||\(|`|\$\()\s*cd(?=\s|$)/u;

// SHELL takes exec form; joined, its argv is the prefix every shell-form RUN
// is wrapped in (e.g. /bin/bash -o pipefail -c). Any other spelling is
// rejected by Docker, so it cannot be enabling pipefail.
const shellDirectiveEnablesPipefail = (args: string): boolean => {
  const argv = parseExecForm(args);

  return argv !== null && PIPEFAIL_SETTING_RE.test(argv.join(" "));
};

// True when a RUN pipes without pipefail. SHELL only applies to shell-form
// RUN; exec-form RUN runs its own argv directly, so check the argv for
// pipefail instead. Exec-form argv elements arrive already unquoted, so a
// pipe inside them is a real pipe; shell-form text is masked so a `|` inside
// a quoted argument (grep -E "foo|bar") does not read as a pipeline.
const pipesWithoutPipefail = (
  args: string,
  shellHasPipefail: boolean
): boolean => {
  const execArgv = parseExecForm(args);

  const pipeText = withoutNonPipeBars(
    execArgv === null ? maskQuotedText(args) : execArgv.join(" ")
  );

  if (!HAS_PIPE_RE.test(pipeText)) {
    return false;
  }

  const pipefailConfigured =
    execArgv === null
      ? shellHasPipefail || PIPEFAIL_SETTING_RE.test(args)
      : PIPEFAIL_SETTING_RE.test(execArgv.join(" "));

  return !pipefailConfigured;
};

export const usePipefail: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];
    // FROM <previous stage> inherits that stage's image config — SHELL
    // included (verified against BuildKit); FROM a fresh base image, or the
    // reserved empty stage `scratch`, resets it to the Docker default. A
    // SHELL instruction replaces it for the rest of the current stage.
    // NOTE: FROM ${VAR} (variable base) misses the map lookup and silently
    // resets — fails safe (extra warning, never a missed one).
    const stagePipefail = new Map<string, boolean>();
    let shellHasPipefail = false;
    let currentStage: string | null = null;

    for (const inst of instructions) {
      if (inst.instruction === "FROM") {
        const { base, stage } = parseFromArgs(inst.args);

        const parentStage = isScratch(base)
          ? null
          : (base?.toLowerCase() ?? null);

        shellHasPipefail =
          parentStage !== null && stagePipefail.get(parentStage) === true;
        currentStage = stage?.toLowerCase() ?? null;

        if (hasText(currentStage)) {
          stagePipefail.set(currentStage, shellHasPipefail);
        }
      } else if (inst.instruction === "SHELL") {
        shellHasPipefail = shellDirectiveEnablesPipefail(inst.args);

        if (hasText(currentStage)) {
          stagePipefail.set(currentStage, shellHasPipefail);
        }
      } else if (
        inst.instruction === "RUN" &&
        pipesWithoutPipefail(inst.args, shellHasPipefail)
      ) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            "RUN instruction uses a pipe (|) but does not configure 'pipefail'. If a command in the pipe fails, the step may still succeed silently.",
            this.help,
            inst.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: 'Prepend `set -o pipefail &&` to pipe commands, use exec form with a shell that supports it (e.g., `RUN ["/bin/bash", "-c", "set -o pipefail && ..."]`), or set `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` at the top of the stage.',
  key: "docker-doctor/use-pipefail",
  message: "Use pipefail to catch pipeline command failures",
};

// BuildKit strips one pair of surrounding quotes from the WORKDIR path, which
// is how a path with spaces is written: `WORKDIR "/my app"`.
const SURROUNDING_QUOTES_RE = /^(?<quote>["'])(?<inner>.*)\k<quote>$/u;

export const absoluteWorkdir: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "WORKDIR") {
        const trimmed = inst.args.trim();

        const path =
          SURROUNDING_QUOTES_RE.exec(trimmed)?.groups?.inner ?? trimmed;

        const isAbsolute = /^(?:\/|\\|\$|[a-zA-Z]:)/u.test(path);

        if (!isAbsolute) {
          diagnostics.push(
            createDiagnostic(
              file,
              this.key,
              this.defaultSeverity,
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
  help: "Always specify absolute paths for WORKDIR instructions (e.g. `WORKDIR /app`).",
  key: "docker-doctor/absolute-workdir",
  message: "Use absolute paths for WORKDIR",
};

export const avoidRunCd: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      // Exec-form RUN ["sh", "-c", "cd /app && make"] keeps its whole
      // command inside quotes and is intentionally not flagged: this rule is
      // about shell-form layering.
      if (
        inst.instruction === "RUN" &&
        CD_COMMAND_RE.test(maskQuotedText(stripRunFlags(inst.args)))
      ) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
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
  help: "Use the WORKDIR instruction instead of `cd` inside RUN to establish directory context.",
  key: "docker-doctor/avoid-run-cd",
  message: "Avoid changing directories with cd in RUN",
};

const PACKAGE_LIST_START_RE =
  /\b(?:apt-get(?:\s+-\S+)*\s+install|apk\s+add|yum\s+install|dnf\s+install)\b/u;

const SHELL_SEPARATOR_RE = /[;|]|&&/u;
const WHITESPACE_RE = /\s+/u;

// A newline with no backslash before it. In a heredoc body it ends the
// command. A `\`-continued RUN has none.
const UNCONTINUED_NEWLINE_RE = /\r\n(?<!\\[ \t]*\r\n)|\n(?<!\\[ \t]*\n)/u;

// Options whose value is the next word, as listed in apt-get(8), apk(8) and
// apk-add(8). `apk add --virtual .build-deps gcc` names a group, not a
// package.
const APT_GET_VALUE_OPTIONS = new Set([
  "-a",
  "--host-architecture",
  "-c",
  "--config-file",
  "-o",
  "--option",
  "-P",
  "--build-profiles",
  "-t",
  "--target-release",
  "--default-release",
  "--with-source",
]);

const APK_VALUE_OPTIONS = new Set([
  "--arch",
  "--cache-dir",
  "--cache-max-age",
  "--keys-dir",
  "-p",
  "--root",
  "--repositories-file",
  "-X",
  "--repository",
  "--repository-config",
  "--timeout",
  "-t",
  "--virtual",
]);

const NO_VALUE_OPTIONS = new Set<string>();

const valueOptionsFor = (command: string): Set<string> => {
  if (command.startsWith("apt-get")) {
    return APT_GET_VALUE_OPTIONS;
  }

  if (command.startsWith("apk")) {
    return APK_VALUE_OPTIONS;
  }

  return NO_VALUE_OPTIONS;
};

// The words after the install verb up to the next shell separator or
// command-ending newline, minus options, their values and continuation
// backslashes. Everything past that point belongs to another command, so it
// is not part of the list.
const collectPackageList = (raw: string): string[] => {
  const start = PACKAGE_LIST_START_RE.exec(raw);

  if (!start) {
    return [];
  }

  const valueOptions = valueOptionsFor(start[0]);
  const packages: string[] = [];

  const [command] = raw
    .slice(start.index + start[0].length)
    .split(UNCONTINUED_NEWLINE_RE);

  const tokens = command.split(WHITESPACE_RE);

  const separatorIndex = tokens.findIndex((token) =>
    SHELL_SEPARATOR_RE.test(token)
  );

  const words =
    separatorIndex === -1 ? tokens : tokens.slice(0, separatorIndex);

  let isOptionValue = false;

  for (const token of words) {
    if (token === "" || token === "\\") {
      continue;
    }

    if (isOptionValue) {
      isOptionValue = false;
    } else if (token.startsWith("-")) {
      isOptionValue = valueOptions.has(token);
    } else {
      packages.push(token);
    }
  }

  return packages;
};

export const sortMultilineArgs: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "RUN") {
        const { raw } = inst;

        const isPackageInstall =
          hasAptGetInstall(raw) ||
          raw.includes("apk add") ||
          raw.includes("yum install") ||
          raw.includes("dnf install");

        const hasContinuation = raw.includes("\\\n") || raw.includes("\\\r\n");

        if (isPackageInstall && hasContinuation) {
          const packages = collectPackageList(raw);

          if (packages.length > 1) {
            // The default comparator orders by code unit, so the verdict does
            // not depend on the machine's locale.
            const sorted = packages.toSorted();
            const isSorted = packages.every((val, idx) => val === sorted[idx]);

            if (!isSorted) {
              diagnostics.push(
                createDiagnostic(
                  file,
                  this.key,
                  this.defaultSeverity,
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

const USERADD_COMMAND_RE = /^(?:.*\/)?useradd$/u;
const SHORT_OPTION_CLUSTER_RE = /^-[^-]/u;
const ENV_ASSIGNMENT_WORD_RE = /^[A-Za-z_]\w*=/u;
const SHELL_COMMAND_FLAG_RE = /^-\w*c$/u;

// hadolint's DL3046 reads a UID of six or more digits as large. Docker's own
// guidance names no cut-off, only "large UIDs". A smaller UID such as 65532
// still makes a sparse lastlog of about 19 MB, which this rule accepts as a
// miss rather than warn every `useradd -u 1000`.
const LARGE_UID_RE = /^\d{6,}$/u;

// useradd's short options that take a value, from the shadow-utils getopt
// string `b:c:d:De:f:g:G:hk:K:lmMNop:rR:P:s:u:U` plus SELinux's `Z:`.
const USERADD_VALUE_OPTION_RE = /[bcdefgGkKpRPsuZ]/u;

interface UseraddOptions {
  noLogInit: boolean;
  uid: string | null;
}

// Reads a short option cluster and returns how many words it used. `-l` is
// the short spelling of `--no-log-init`, and short options cluster
// (`useradd -rl app`). In `-lu1000` the `l` is a flag, but in `-u1000l` or
// `-gwheel` it is part of the value. A value that is not attached
// (`-u 1000`) is the next word.
const readShortOptions = (
  words: string[],
  index: number,
  options: UseraddOptions
): number => {
  const cluster = words[index].slice(1);
  const valueAt = cluster.search(USERADD_VALUE_OPTION_RE);
  const flags = valueAt === -1 ? cluster : cluster.slice(0, valueAt);

  if (flags.includes("l")) {
    options.noLogInit = true;
  }

  if (valueAt === -1) {
    return 1;
  }

  const attached = cluster.slice(valueAt + 1);

  if (cluster[valueAt] === "u") {
    options.uid = attached === "" ? (words[index + 1] ?? null) : attached;
  }

  return attached === "" ? 2 : 1;
};

const readUseraddOptions = (words: string[]): UseraddOptions => {
  const options: UseraddOptions = { noLogInit: false, uid: null };
  let index = 0;

  while (index < words.length) {
    const word = words[index];

    if (word === "--no-log-init") {
      options.noLogInit = true;
      index += 1;
    } else if (word === "--uid") {
      options.uid = words[index + 1] ?? null;
      index += 2;
    } else if (word.startsWith("--uid=")) {
      options.uid = word.slice("--uid=".length);
      index += 1;
    } else if (SHORT_OPTION_CLUSTER_RE.test(word)) {
      index += readShortOptions(words, index, options);
    } else {
      index += 1;
    }
  }

  return options;
};

// The words of `command` once leading `NAME=value` assignments and `sudo` are
// dropped, so a `useradd` there counts as running.
const commandWords = (command: string): string[] => {
  const words = splitShellWords(command);
  const first = words.findIndex((word) => !ENV_ASSIGNMENT_WORD_RE.test(word));

  if (first === -1) {
    return [];
  }

  return words[first] === "sudo" ? words.slice(first + 1) : words.slice(first);
};

// Only a command that names useradd can be one, so the rest skip word
// splitting.
const useraddCandidates = (script: string): string[][] => {
  const candidates: string[][] = [];

  for (const command of splitShellCommands(script)) {
    if (command.includes("useradd")) {
      candidates.push(commandWords(command));
    }
  }

  return candidates;
};

// The simple commands of one RUN. Exec form is its own argv, and a shell
// started with -c runs the script in its next argument.
const runCommandWords = (args: string): string[][] => {
  const argv = parseExecForm(args);

  if (argv === null) {
    return useraddCandidates(stripRunFlags(args));
  }

  const [, flag, script] = argv;

  if (flag !== undefined && SHELL_COMMAND_FLAG_RE.test(flag) && script) {
    return useraddCandidates(script);
  }

  return [argv];
};

// True when a `useradd` in this RUN sets a large UID without `-l`. The flag
// must belong to the same command as `useradd`, so `useradd app && ls -l`
// has none.
const useraddWritesLoginLogs = (args: string): boolean =>
  args.includes("useradd") &&
  runCommandWords(args).some(([command, ...words]) => {
    if (command === undefined || !USERADD_COMMAND_RE.test(command)) {
      return false;
    }

    const { noLogInit, uid } = readUseraddOptions(words);

    return !noLogInit && uid !== null && LARGE_UID_RE.test(uid);
  });

export const useraddNoLogInit: DockerfileRule = {
  category: BEST_PRACTICES,
  check(instructions, file) {
    const diagnostics: Diagnostic[] = [];

    for (const inst of instructions) {
      if (inst.instruction === "RUN" && useraddWritesLoginLogs(inst.args)) {
        diagnostics.push(
          createDiagnostic(
            file,
            this.key,
            this.defaultSeverity,
            "RUN instruction runs 'useradd' with a large UID and without '--no-log-init'. A large UID makes useradd write a very large sparse lastlog file, and Go's sparse tar archive bug can then use excessive disk space.",
            this.help,
            inst.line
          )
        );
      }
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Pass `--no-log-init` or its short form `-l` to useradd when it sets a large UID (e.g., `RUN useradd --no-log-init -r -u 1000000 -g mygroup myuser`).",
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
