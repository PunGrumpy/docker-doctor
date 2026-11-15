#!/usr/bin/env bun
import { realpathSync } from "node:fs";
import {
  appendFile,
  cp,
  mkdir,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import cliPackage from "../../../../packages/docker-doctor/package.json" with { type: "json" };

const TOOL = "control-docker-doctor";

const USAGE = `usage: ${TOOL} <action> [--run <name>] [args] [-- <docker-doctor args>]

actions:
  up                  create the run's work/home/tmp dirs and state.json
  doctor              read-only health check of the run, the build and docker
  fixture <name>...   copy test fixtures into the run's work dir
  run -- <args>       run the built docker-doctor CLI inside the work dir
  image-build <dir>   docker build a work dir under ddverify labels
  down                remove the run's images and dirs, keep the evidence`;

// docker-doctor itself exits 0, 1, 2, 130 or 143. 64 (EX_USAGE) is none of
// them, so a refusal never reads as a scan result.
const REFUSAL_EXIT_CODE = 64;
const RUN_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/u;
const FIXTURE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const IMAGE_ID_PATTERN = /^[a-f0-9]{12,64}$/u;
const DEFAULT_RUN = "default";
const DOCKER_TIMEOUT_MS = 15_000;
const VERSION_TIMEOUT_MS = 15_000;
const CLI_TIMEOUT_MS = 120_000;
const BUILD_TIMEOUT_MS = 900_000;
const SLUG_MAX_LENGTH = 48;
const SEQUENCE_WIDTH = 2;
const BUILD_COMMAND = "bun run build --filter @docker-doctor/cli";
const DIST_MISSING = "skipped; dist/cli.mjs is missing";

const REPO_ROOT = path.resolve(
  path.dirname(realpathSync(import.meta.filename)),
  "../../../.."
);

const CLI_PATH = path.join(REPO_ROOT, "packages/docker-doctor/dist/cli.mjs");

const FIXTURES_DIR = path.join(
  REPO_ROOT,
  "packages/docker-doctor/test/fixtures"
);

const SOURCE_DIRS = [
  path.join(REPO_ROOT, "packages/docker-doctor/src"),
  path.join(REPO_ROOT, "packages/core/src"),
];

const NON_ALNUM = /[^a-z0-9]+/u;
const TRAILING_DASH = /-$/u;
const SAFE_SHELL_WORD = /^[\w@%+=:,./-]+$/u;
const WHITESPACE_RUN = /\s+/gu;
const LEADING_SEQUENCE = /^(?<sequence>\d+)-/u;
const PATH_SEPARATORS = /[\\/]/u;

class RefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefusalError";
  }
}

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const complain = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

interface RunPaths {
  evidenceDir: string;
  homeDir: string;
  indexFile: string;
  name: string;
  root: string;
  runDir: string;
  stateFile: string;
  tmpDir: string;
  workDir: string;
}

interface RunState {
  cliVersion: string;
  createdAt: string;
  repo: string;
  run: string;
}

const resolveRoot = (): string => {
  const configured = process.env.DDVERIFY_ROOT ?? "";

  const root = path.resolve(
    configured === "" ? path.join(tmpdir(), "ddverify") : configured
  );

  if (path.parse(root).root === root) {
    throw new RefusalError("DDVERIFY_ROOT must not be the filesystem root");
  }

  return root;
};

const createRunPaths = (rawName: string): RunPaths => {
  if (!RUN_NAME_PATTERN.test(rawName)) {
    throw new RefusalError(
      `run name "${rawName}" must match ${RUN_NAME_PATTERN.source}`
    );
  }

  const root = resolveRoot();
  const runDir = path.join(root, "runs", rawName);
  const evidenceDir = path.join(root, "evidence", rawName);

  return {
    evidenceDir,
    homeDir: path.join(runDir, "home"),
    indexFile: path.join(evidenceDir, "index.tsv"),
    name: rawName,
    root,
    runDir,
    stateFile: path.join(runDir, "state.json"),
    tmpDir: path.join(runDir, "tmp"),
    workDir: path.join(runDir, "work"),
  };
};

const statOrNull = async (target: string) => {
  try {
    return await stat(target);
  } catch {
    return null;
  }
};

const fileExists = async (target: string): Promise<boolean> =>
  (await statOrNull(target)) !== null;

const isDirectory = async (target: string): Promise<boolean> => {
  const found = await statOrNull(target);

  return found?.isDirectory() === true;
};

const requireUp = async (paths: RunPaths): Promise<void> => {
  if (!(await fileExists(paths.stateFile))) {
    throw new RefusalError(
      `run "${paths.name}" is not up; run: ${TOOL} up --run ${paths.name}`
    );
  }
};

interface CommandResult {
  code: number;
  spawnError: Error | null;
  stderr: string;
  stdout: string;
}

interface ExecuteOptions {
  cwd?: string;
  env: Record<string, string | undefined>;
  tee: boolean;
  timeoutMs: number;
}

const trySpawn = (
  file: string,
  args: readonly string[],
  options: ExecuteOptions
) => {
  try {
    return Bun.spawn([file, ...args], {
      cwd: options.cwd,
      env: options.env,
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
      timeout: options.timeoutMs,
    });
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

const drain = async (
  stream: ReadableStream<Uint8Array>,
  sink: NodeJS.WriteStream | null
): Promise<string> => {
  const decoder = new TextDecoder();
  let text = "";

  for await (const chunk of stream) {
    sink?.write(chunk);
    text += decoder.decode(chunk, { stream: true });
  }

  return text + decoder.decode();
};

const execute = async (
  file: string,
  args: readonly string[],
  options: ExecuteOptions
): Promise<CommandResult> => {
  const child = trySpawn(file, args, options);

  if (child instanceof Error) {
    return { code: 1, spawnError: child, stderr: "", stdout: "" };
  }

  const [stdout, stderr, code] = await Promise.all([
    drain(child.stdout, options.tee ? process.stdout : null),
    drain(child.stderr, options.tee ? process.stderr : null),
    child.exited,
  ]);

  return { code, spawnError: null, stderr, stdout };
};

type DockerCommand =
  | { kind: "version" }
  | { kind: "build"; run: string; tag: string; dir: string }
  | { kind: "list-images"; run: string }
  | { kind: "remove-image"; id: string };

// Every docker invocation this tool can make is a case of this switch. There
// is no passthrough and no prune, system or container command.
const dockerArgs = (command: DockerCommand): string[] => {
  switch (command.kind) {
    case "version": {
      return ["version", "--format", "{{.Server.Version}}"];
    }

    case "build": {
      return [
        "build",
        "--label",
        "ddverify=1",
        "--label",
        `ddverify.run=${command.run}`,
        "-t",
        command.tag,
        command.dir,
      ];
    }

    case "list-images": {
      return [
        "image",
        "ls",
        "--filter",
        "label=ddverify=1",
        "--filter",
        `label=ddverify.run=${command.run}`,
        "--format",
        "{{.ID}} {{.Repository}}",
      ];
    }

    case "remove-image": {
      return ["image", "rm", command.id];
    }

    default: {
      throw new Error("unreachable docker command");
    }
  }
};

const runDocker = async (
  command: DockerCommand,
  options: { tee: boolean; timeoutMs: number }
): Promise<CommandResult> =>
  await execute("docker", dockerArgs(command), {
    ...options,
    env: process.env,
  });

const probeDockerServer = async (): Promise<string | null> => {
  const result = await runDocker(
    { kind: "version" },
    { tee: false, timeoutMs: DOCKER_TIMEOUT_MS }
  );

  const version = result.stdout.trim();

  return result.spawnError === null && result.code === 0 && version !== ""
    ? version
    : null;
};

const listRunImages = async (runName: string): Promise<string[]> => {
  const result = await runDocker(
    { kind: "list-images", run: runName },
    { tee: false, timeoutMs: DOCKER_TIMEOUT_MS }
  );

  return result.code === 0
    ? result.stdout.split("\n").filter((line) => line.trim() !== "")
    : [];
};

const cleanEnv = (paths: RunPaths) => ({
  HOME: paths.homeDir,
  NO_COLOR: "1",
  PATH: process.env.PATH ?? "",
  TMPDIR: paths.tmpDir,
  XDG_CACHE_HOME: path.join(paths.homeDir, ".cache"),
  XDG_CONFIG_HOME: path.join(paths.homeDir, ".config"),
  XDG_DATA_HOME: path.join(paths.homeDir, ".local/share"),
});

const quote = (word: string): string =>
  SAFE_SHELL_WORD.test(word) ? word : JSON.stringify(word);

const commandLine = (words: readonly string[]): string =>
  words.map(quote).join(" ");

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .split(NON_ALNUM)
    .filter((word) => word !== "")
    .join("-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(TRAILING_DASH, "");

const resolveThroughSymlinks = async (
  target: string,
  tail: readonly string[] = []
): Promise<string> => {
  try {
    return path.resolve(await realpath(target), ...tail);
  } catch {
    const parent = path.dirname(target);

    return parent === target
      ? path.resolve(target, ...tail)
      : await resolveThroughSymlinks(parent, [path.basename(target), ...tail]);
  }
};

const isInside = (root: string, target: string): boolean => {
  const rel = path.relative(root, target);

  return !(
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  );
};

// A `..` after a symlink resolves differently on disk than in a lexical
// normalise, so the two readings of one path could disagree about where it
// lands. Refusing the segment removes the ambiguity.
const resolveInsideWork = async (
  workDir: string,
  raw: string,
  label: string
): Promise<string> => {
  if (raw.split(PATH_SEPARATORS).includes("..")) {
    throw new RefusalError(`${label} "${raw}" contains a ".." segment`);
  }

  const workReal = await realpath(workDir);
  const target = await resolveThroughSymlinks(path.resolve(workDir, raw));

  if (!isInside(workReal, target)) {
    throw new RefusalError(
      `${label} "${raw}" resolves to ${target}, outside the work dir ${workReal}`
    );
  }

  return target;
};

interface PathArg {
  label: string;
  value: string;
}

type Awaiting = { isPath: boolean; label: string } | null;

type FlagEffect =
  | { kind: "none" }
  | { kind: "awaits"; awaiting: NonNullable<Awaiting> }
  | { kind: "path"; arg: PathArg };

const NON_SCAN_MODES = ["install", "rules", "help"] as const;
const PATH_VALUE_FLAGS = new Set(["-c", "--config", "--baseline"]);
const PLAIN_VALUE_FLAGS = new Set(["--fail-on"]);

const isShortFlags = (arg: string): boolean =>
  arg.startsWith("-") && !arg.startsWith("--");

const isGlobalFlag = (arg: string): boolean =>
  arg === "--global" ||
  arg.startsWith("--global=") ||
  (isShortFlags(arg) && arg.includes("g"));

const bundlesConfigFlag = (arg: string): boolean =>
  isShortFlags(arg) && arg.length > 2 && arg.includes("c");

const assertAllowedToken = (arg: string): void => {
  if (isGlobalFlag(arg)) {
    throw new RefusalError(
      `${arg} would write outside the run's work dir (global install)`
    );
  }

  if (bundlesConfigFlag(arg)) {
    throw new RefusalError(
      `${arg} bundles -c, whose path cannot be checked; pass --config <path>`
    );
  }
};

const classifyFlag = (arg: string): FlagEffect => {
  const equalsAt = arg.indexOf("=");
  const hasValue = equalsAt !== -1;
  const flag = hasValue ? arg.slice(0, equalsAt) : arg;

  if (PATH_VALUE_FLAGS.has(flag)) {
    return hasValue
      ? { arg: { label: flag, value: arg.slice(equalsAt + 1) }, kind: "path" }
      : { awaiting: { isPath: true, label: flag }, kind: "awaits" };
  }

  return PLAIN_VALUE_FLAGS.has(flag) && !hasValue
    ? { awaiting: { isPath: false, label: flag }, kind: "awaits" }
    : { kind: "none" };
};

interface ParseState {
  awaiting: Awaiting;
  flagPaths: PathArg[];
  optionsEnded: boolean;
  positionals: string[];
}

const consumeToken = (state: ParseState, arg: string): void => {
  assertAllowedToken(arg);

  if (state.awaiting !== null) {
    if (state.awaiting.isPath) {
      state.flagPaths.push({ label: state.awaiting.label, value: arg });
    }

    state.awaiting = null;
  } else if (state.optionsEnded || !arg.startsWith("-")) {
    state.positionals.push(arg);
  } else if (arg === "--") {
    state.optionsEnded = true;
  } else {
    const effect = classifyFlag(arg);

    if (effect.kind === "path") {
      state.flagPaths.push(effect.arg);
    } else if (effect.kind === "awaits") {
      state.awaiting = effect.awaiting;
    }
  }
};

const pathsToCheck = (args: readonly string[]): PathArg[] => {
  const state: ParseState = {
    awaiting: null,
    flagPaths: [],
    optionsEnded: false,
    positionals: [],
  };

  for (const arg of args) {
    consumeToken(state, arg);
  }

  const [first = ""] = state.positionals;
  const isScan = !NON_SCAN_MODES.some((mode) => mode === first);

  // install, rules and help take no paths; install writes into the child's cwd.
  return isScan
    ? [
        ...state.positionals.map((value) => ({ label: "path", value })),
        ...state.flagPaths,
      ]
    : [];
};

const assertInvocationAllowed = async (
  paths: RunPaths,
  args: readonly string[]
): Promise<void> => {
  await Promise.all(
    pathsToCheck(args).map(
      async (entry) =>
        await resolveInsideWork(paths.workDir, entry.value, entry.label)
    )
  );
};

interface EvidenceEntry {
  command: string;
  cwd: string;
  exit: number | "refused";
  slug: string;
  stderr: string;
  stdout: string;
}

const redactions = async (
  paths: RunPaths
): Promise<readonly (readonly [string, string])[]> => {
  const [workReal, runReal] = await Promise.all([
    resolveThroughSymlinks(paths.workDir),
    resolveThroughSymlinks(paths.runDir),
  ]);

  const pairs: [string, string][] = [
    [paths.workDir, "$WORK"],
    [workReal, "$WORK"],
    [paths.runDir, "$RUN_DIR"],
    [runReal, "$RUN_DIR"],
  ];

  return pairs.toSorted((a, b) => b[0].length - a[0].length);
};

const nextSequence = async (evidenceDir: string): Promise<number> => {
  const names = await readdir(evidenceDir);

  const used = names.map((name) =>
    Number(LEADING_SEQUENCE.exec(name)?.groups?.sequence ?? 0)
  );

  return Math.max(0, ...used) + 1;
};

const recordEvidence = async (
  paths: RunPaths,
  entry: EvidenceEntry
): Promise<string> => {
  await mkdir(paths.evidenceDir, { recursive: true });

  const replacements = await redactions(paths);

  const redact = (text: string): string => {
    let redacted = text;

    for (const [needle, token] of replacements) {
      redacted = redacted.replaceAll(needle, token);
    }

    return redacted;
  };

  const sequence = String(await nextSequence(paths.evidenceDir)).padStart(
    SEQUENCE_WIDTH,
    "0"
  );

  const file = path.join(paths.evidenceDir, `${sequence}-${entry.slug}.txt`);
  const command = redact(entry.command);

  await writeFile(
    file,
    [
      `command: ${command}`,
      `cwd: ${redact(entry.cwd)}`,
      `exit: ${entry.exit}`,
      "--- stdout",
      redact(entry.stdout),
      "--- stderr",
      redact(entry.stderr),
      "",
    ].join("\n")
  );
  await appendFile(
    paths.indexFile,
    `${new Date().toISOString()}\t${entry.exit}\t${path.basename(file)}\t${command.replaceAll(WHITESPACE_RUN, " ")}\n`
  );
  complain(`${TOOL}: evidence ${file}`);

  return file;
};

const printRefusal = (error: RefusalError): void => {
  complain(`${TOOL}: refused: ${error.message}`);
};

const refuseWithEvidence = async (
  paths: RunPaths,
  target: { command: string; slug: string },
  error: RefusalError
): Promise<number> => {
  printRefusal(error);
  await recordEvidence(paths, {
    ...target,
    cwd: paths.workDir,
    exit: "refused",
    stderr: `${TOOL}: refused: ${error.message}\n`,
    stdout: "",
  });

  return REFUSAL_EXIT_CODE;
};

interface ActionContext {
  args: readonly string[];
  passthrough: readonly string[];
  paths: RunPaths;
}

type ActionHandler = (context: ActionContext) => Promise<number>;

const rejectExtras = (
  context: ActionContext,
  allowed: { args: boolean; passthrough: boolean }
): void => {
  if (!allowed.args && context.args.length > 0) {
    throw new RefusalError(
      `unexpected arguments: ${commandLine(context.args)}`
    );
  }

  if (!allowed.passthrough && context.passthrough.length > 0) {
    throw new RefusalError("this action takes no arguments after --");
  }
};

const upAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: false, passthrough: false });

  const { paths } = context;

  if (!(await fileExists(CLI_PATH))) {
    throw new RefusalError(
      `dist/cli.mjs is missing; build it with: ${BUILD_COMMAND}`
    );
  }

  const live = await fileExists(paths.stateFile);

  if (!live) {
    const state: RunState = {
      cliVersion: cliPackage.version,
      createdAt: new Date().toISOString(),
      repo: REPO_ROOT,
      run: paths.name,
    };

    await Promise.all(
      [
        paths.workDir,
        paths.tmpDir,
        paths.evidenceDir,
        path.join(paths.homeDir, ".cache"),
        path.join(paths.homeDir, ".config"),
        path.join(paths.homeDir, ".local/share"),
      ].map(async (dir) => await mkdir(dir, { recursive: true }))
    );
    await writeFile(paths.stateFile, `${JSON.stringify(state, null, 2)}\n`);
  }

  say(`ready ${paths.name}${live ? " (already up, unchanged)" : ""}`);
  say(`work ${paths.workDir}`);
  say(`evidence ${paths.evidenceDir}`);

  return 0;
};

type CheckStatus = "ok" | "FAIL" | "info";

interface Check {
  detail: string;
  name: string;
  status: CheckStatus;
}

const CHECK_NAMES = {
  cliVersion: "cli-version",
  dist: "dist",
  distFresh: "dist-fresh",
  docker: "docker",
  images: "images",
  node: "node",
  runDirs: "run-dirs",
} as const;

const check = (status: CheckStatus, name: string, detail: string): Check => ({
  detail,
  name,
  status,
});

const newestSource = async (
  dirs: readonly string[]
): Promise<{ file: string; mtimeMs: number }> => {
  const listings = await Promise.all(
    dirs.map(
      async (dir) =>
        await readdir(dir, { recursive: true, withFileTypes: true })
    )
  );

  const files = listings
    .flat()
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));

  const stamped = await Promise.all(
    files.map(async (file) => {
      const info = await stat(file);

      return { file, mtimeMs: info.mtimeMs };
    })
  );

  let newest = { file: "", mtimeMs: 0 };

  for (const candidate of stamped) {
    if (candidate.mtimeMs > newest.mtimeMs) {
      newest = candidate;
    }
  }

  return newest;
};

const checkRunDirs = async (paths: RunPaths): Promise<Check> => {
  const required = [
    paths.runDir,
    paths.workDir,
    paths.homeDir,
    paths.tmpDir,
    paths.stateFile,
    paths.evidenceDir,
  ];

  const present = await Promise.all(required.map(fileExists));
  const missing = required.filter((_, index) => !present[index]);

  return missing.length === 0
    ? check("ok", CHECK_NAMES.runDirs, paths.runDir)
    : check(
        "FAIL",
        CHECK_NAMES.runDirs,
        `missing ${missing.join(", ")}; run: ${TOOL} up --run ${paths.name}`
      );
};

const checkDist = (distPresent: boolean): Check =>
  distPresent
    ? check("ok", CHECK_NAMES.dist, CLI_PATH)
    : check(
        "FAIL",
        CHECK_NAMES.dist,
        `${CLI_PATH} is missing; run: ${BUILD_COMMAND}`
      );

const checkVersion = async (distPresent: boolean): Promise<Check> => {
  if (!distPresent) {
    return check("info", CHECK_NAMES.cliVersion, DIST_MISSING);
  }

  const result = await execute("node", [CLI_PATH, "--version"], {
    env: { NO_COLOR: "1", PATH: process.env.PATH ?? "" },
    tee: false,
    timeoutMs: VERSION_TIMEOUT_MS,
  });

  const actual = result.stdout.trim();

  return actual === cliPackage.version
    ? check("ok", CHECK_NAMES.cliVersion, actual)
    : check(
        "FAIL",
        CHECK_NAMES.cliVersion,
        `dist reports "${actual}" but package.json says ${cliPackage.version}; run: ${BUILD_COMMAND}`
      );
};

const checkFreshness = async (distPresent: boolean): Promise<Check> => {
  if (!distPresent) {
    return check("info", CHECK_NAMES.distFresh, DIST_MISSING);
  }

  const [built, newest] = await Promise.all([
    stat(CLI_PATH),
    newestSource(SOURCE_DIRS),
  ]);

  const sourceName = path.relative(REPO_ROOT, newest.file);

  return built.mtimeMs >= newest.mtimeMs
    ? check("ok", CHECK_NAMES.distFresh, `newer than ${sourceName}`)
    : check(
        "FAIL",
        CHECK_NAMES.distFresh,
        `${sourceName} is newer than dist/cli.mjs; run: ${BUILD_COMMAND}`
      );
};

const checkNode = async (): Promise<Check> => {
  const result = await execute("node", ["--version"], {
    env: { PATH: process.env.PATH ?? "" },
    tee: false,
    timeoutMs: VERSION_TIMEOUT_MS,
  });

  return result.spawnError === null && result.code === 0
    ? check("ok", CHECK_NAMES.node, result.stdout.trim())
    : check("FAIL", CHECK_NAMES.node, "node is not on PATH");
};

const checkDocker = async (paths: RunPaths): Promise<Check[]> => {
  const version = await probeDockerServer();

  if (version === null) {
    return [
      check("info", CHECK_NAMES.docker, "unavailable; image-build disabled"),
    ];
  }

  const images = await listRunImages(paths.name);

  return [
    check("ok", CHECK_NAMES.docker, `server ${version}`),
    ...(images.length === 0
      ? [check("info", CHECK_NAMES.images, "none")]
      : images.map((line) => check("info", CHECK_NAMES.images, line))),
  ];
};

const doctorAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: false, passthrough: false });

  const { paths } = context;
  const distPresent = await fileExists(CLI_PATH);

  const checks: Check[] = [
    await checkRunDirs(paths),
    checkDist(distPresent),
    await checkVersion(distPresent),
    await checkFreshness(distPresent),
    await checkNode(),
    ...(await checkDocker(paths)),
  ];

  for (const entry of checks) {
    say(`${entry.status} ${entry.name} ${entry.detail}`);
  }

  return checks.some((entry) => entry.status === "FAIL") ? 1 : 0;
};

const fixtureAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: true, passthrough: false });

  const { args, paths } = context;

  if (args.length === 0) {
    throw new RefusalError("fixture needs at least one fixture name");
  }

  await requireUp(paths);

  const available = new Set(await readdir(FIXTURES_DIR));

  for (const name of args) {
    if (!FIXTURE_NAME_PATTERN.test(name) || !available.has(name)) {
      const known = [...available].toSorted((a, b) => a.localeCompare(b));

      throw new RefusalError(
        `unknown fixture "${name}"; available: ${known.join(", ")}`
      );
    }
  }

  await Promise.all(
    args.map(async (name) => {
      const destination = path.join(paths.workDir, name);

      await rm(destination, { force: true, recursive: true });
      await cp(path.join(FIXTURES_DIR, name), destination, {
        recursive: true,
      });
      say(`fixture ${name} ${destination}`);
    })
  );

  return 0;
};

const runAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: false, passthrough: true });

  const { passthrough, paths } = context;

  await requireUp(paths);

  const target = {
    command: commandLine([
      "node",
      path.relative(REPO_ROOT, CLI_PATH),
      ...passthrough,
    ]),
    slug: `run-${slugify(passthrough.join(" "))}`,
  };

  try {
    await assertInvocationAllowed(paths, passthrough);
  } catch (error) {
    if (error instanceof RefusalError) {
      return await refuseWithEvidence(paths, target, error);
    }

    throw error;
  }

  const result = await execute("node", [CLI_PATH, ...passthrough], {
    cwd: paths.workDir,
    env: cleanEnv(paths),
    tee: true,
    timeoutMs: CLI_TIMEOUT_MS,
  });

  await recordEvidence(paths, {
    ...target,
    cwd: paths.workDir,
    exit: result.code,
    stderr: result.stderr,
    stdout: result.stdout,
  });

  return result.code;
};

const imageTag = (runName: string, dir: string): string => {
  const name = slugify(path.basename(dir));

  return `ddverify-${runName}-${name === "" ? "dir" : name}:latest`;
};

const planBuild = async (
  paths: RunPaths,
  raw: string
): Promise<DockerCommand> => {
  const dir = await resolveInsideWork(paths.workDir, raw, "directory");

  if (!(await isDirectory(dir))) {
    throw new RefusalError(`"${raw}" is not a directory inside the work dir`);
  }

  if ((await probeDockerServer()) === null) {
    throw new RefusalError("docker is unreachable; image-build is disabled");
  }

  return {
    dir,
    kind: "build",
    run: paths.name,
    tag: imageTag(paths.name, dir),
  };
};

const imageBuildAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: true, passthrough: false });

  const { args, paths } = context;
  const [raw, ...extra] = args;

  if (raw === undefined || extra.length > 0) {
    throw new RefusalError(
      "image-build takes exactly one directory inside work"
    );
  }

  await requireUp(paths);

  const target = {
    command: `image-build ${quote(raw)}`,
    slug: `image-build-${slugify(raw)}`,
  };

  let build: DockerCommand;

  try {
    build = await planBuild(paths, raw);
  } catch (error) {
    if (error instanceof RefusalError) {
      return await refuseWithEvidence(paths, target, error);
    }

    throw error;
  }

  const result = await runDocker(build, {
    tee: true,
    timeoutMs: BUILD_TIMEOUT_MS,
  });

  await recordEvidence(paths, {
    command: `docker ${commandLine(dockerArgs(build))}`,
    cwd: paths.workDir,
    exit: result.code,
    slug: target.slug,
    stderr: result.stderr,
    stdout: result.stdout,
  });

  return result.code;
};

const removeImage = async (id: string, repository: string): Promise<number> => {
  const result = await runDocker(
    { id, kind: "remove-image" },
    { tee: false, timeoutMs: DOCKER_TIMEOUT_MS }
  );

  if (result.code === 0) {
    say(`removed image ${id} ${repository}`);

    return 0;
  }

  complain(`${TOOL}: could not remove image ${id}: ${result.stderr.trim()}`);

  return 1;
};

const removeRunImages = async (paths: RunPaths): Promise<number> => {
  const prefix = `ddverify-${paths.name}-`;
  const owned = new Map<string, string>();

  for (const line of await listRunImages(paths.name)) {
    const [id = "", repository = ""] = line.trim().split(" ");

    if (IMAGE_ID_PATTERN.test(id) && repository.startsWith(prefix)) {
      owned.set(id, repository);
    }
  }

  if (owned.size === 0) {
    say("info no images to remove");

    return 0;
  }

  const failures = await Promise.all(
    [...owned].map(
      async ([id, repository]) => await removeImage(id, repository)
    )
  );

  return failures.some((failure) => failure !== 0) ? 1 : 0;
};

const removeRunDir = async (paths: RunPaths): Promise<void> => {
  const expected = path.join(paths.root, "runs", paths.name);

  const isRunDir =
    paths.runDir === expected &&
    path.basename(path.dirname(paths.runDir)) === "runs" &&
    RUN_NAME_PATTERN.test(path.basename(paths.runDir));

  if (!isRunDir) {
    throw new RefusalError(`${paths.runDir} is not ${expected}`);
  }

  if (!(await fileExists(paths.runDir))) {
    say("info run dir already gone");

    return;
  }

  if (!(await fileExists(paths.stateFile))) {
    throw new RefusalError(
      `${paths.runDir} has no state.json, so it is not a ddverify run dir`
    );
  }

  await rm(paths.runDir, { force: true, recursive: true });
  say(`removed run dir ${paths.runDir}`);
};

const downAction: ActionHandler = async (context) => {
  rejectExtras(context, { args: false, passthrough: false });

  const { paths } = context;
  let failed = 0;

  if ((await probeDockerServer()) === null) {
    say("info docker unavailable; no images to remove");
  } else {
    failed = await removeRunImages(paths);
  }

  await removeRunDir(paths);
  say(`kept evidence ${paths.evidenceDir}`);

  return failed;
};

const ACTIONS = {
  doctor: doctorAction,
  down: downAction,
  fixture: fixtureAction,
  "image-build": imageBuildAction,
  run: runAction,
  up: upAction,
} satisfies Record<string, ActionHandler>;

type ActionName = keyof typeof ACTIONS;

const isActionName = (value: string): value is ActionName =>
  Object.hasOwn(ACTIONS, value);

const splitArgv = (
  argv: readonly string[]
): { own: string[]; passthrough: string[] } => {
  const separator = argv.indexOf("--");

  return separator === -1
    ? { own: [...argv], passthrough: [] }
    : {
        own: argv.slice(0, separator),
        passthrough: argv.slice(separator + 1),
      };
};

const main = async (argv: readonly string[]): Promise<number> => {
  const { own, passthrough } = splitArgv(argv);

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: own,
    options: {
      help: { short: "h", type: "boolean" },
      run: { type: "string" },
    },
    strict: true,
  });

  const [action = "", ...args] = positionals;

  if (values.help === true) {
    say(USAGE);

    return 0;
  }

  if (!isActionName(action)) {
    complain(USAGE);

    return REFUSAL_EXIT_CODE;
  }

  try {
    return await ACTIONS[action]({
      args,
      passthrough,
      paths: createRunPaths(values.run ?? DEFAULT_RUN),
    });
  } catch (error) {
    if (error instanceof RefusalError) {
      printRefusal(error);

      return REFUSAL_EXIT_CODE;
    }

    throw error;
  }
};

process.exitCode = await main(process.argv.slice(2));
