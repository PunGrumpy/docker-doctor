import { beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { JsonReport } from "@docker-doctor/core";
import { allRules } from "@docker-doctor/core";

const CLI = path.join(import.meta.dir, "..", "dist", "cli.mjs");
const fixture = (name: string) => path.join(import.meta.dir, "fixtures", name);

const isJsonReport = (value: unknown): value is JsonReport =>
  typeof value === "object" &&
  value !== null &&
  "diagnostics" in value &&
  Array.isArray(value.diagnostics);

// Reads the CLI's --json output. A broken report fails here, by name,
// rather than as an undefined field further down the test.
const parseReport = (text: string): JsonReport => {
  const value: unknown = JSON.parse(text);

  if (!isJsonReport(value)) {
    throw new Error(`Not a docker-doctor JSON report: ${text.slice(0, 200)}`);
  }

  return value;
};

const runCli = async (
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
) => {
  const proc = Bun.spawn(["node", CLI, ...args], {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : undefined,
    stderr: "pipe",
    stdout: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stderr, stdout };
};

beforeAll(async () => {
  const exists = await Bun.file(CLI).exists();

  if (!exists) {
    throw new Error(
      `Built CLI not found at ${CLI}. Run: bun run build --filter @docker-doctor/cli`
    );
  }
});

describe("smoke", () => {
  test("--version exits 0 and prints a semver-like string", async () => {
    const { exitCode, stdout } = await runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });
});

describe("exit codes", () => {
  test("clean fixture with --json exits 0", async () => {
    const { exitCode } = await runCli([fixture("clean"), "--json"]);
    expect(exitCode).toBe(0);
  });

  test("with-error fixture with --json exits 1", async () => {
    const { exitCode } = await runCli([fixture("with-error"), "--json"]);
    expect(exitCode).toBe(1);
  });

  test("clean fixture with --score exits 0", async () => {
    const { exitCode } = await runCli([fixture("clean"), "--score"]);
    expect(exitCode).toBe(0);
  });

  test("rules explain with an unknown rule exits 1 and prints the error", async () => {
    const { exitCode, stderr } = await runCli([
      "rules",
      "explain",
      "docker-doctor/nope",
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });
});

describe("rules subcommands", () => {
  test("rules explain accepts the short rule name", async () => {
    const { exitCode, stdout } = await runCli([
      "rules",
      "explain",
      "no-root-user",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("docker-doctor/no-root-user");
    expect(stdout).toContain("Help / Fix");
  });

  test("rules explain accepts the full rule key", async () => {
    const { exitCode, stdout } = await runCli([
      "rules",
      "explain",
      "docker-doctor/no-root-user",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Help / Fix");
  });

  test("rules list prints every rule", async () => {
    const { exitCode, stdout } = await runCli(["rules", "list"]);
    expect(exitCode).toBe(0);

    for (const rule of allRules) {
      expect(stdout).toContain(`- ${rule.key}`);
    }
  });
});

describe("unanalyzable files", () => {
  test("a Compose file that cannot be parsed exits 2, not 0", async () => {
    const { exitCode } = await runCli([
      fixture("unparseable-compose"),
      "--json",
    ]);

    expect(exitCode).toBe(2);
  });

  test("the failure is reported on stderr and stdout stays valid JSON", async () => {
    const { stderr, stdout } = await runCli([
      fixture("unparseable-compose"),
      "--json",
    ]);

    expect(stderr).toContain("could not analyze");
    expect(() => parseReport(stdout)).not.toThrow();
  });

  test("--score prints nothing when no file was analyzed, and exits 2", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("unparseable-compose"),
      "--score",
    ]);

    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
  });

  test("--score still prints only an integer when some files were analyzed", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("partly-broken"),
      "--score",
    ]);

    expect(exitCode).toBe(2);
    expect(stdout).toMatch(/^\d+\n$/u);
  });

  test("an unterminated heredoc makes the scan incomplete (exit 2) instead of silently clean", async () => {
    const { exitCode, stderr, stdout } = await runCli([
      fixture("unterminated-heredoc"),
      "--json",
    ]);

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unterminated heredoc");
    expect(() => parseReport(stdout)).not.toThrow();
  });

  test("the JSON report lists the file that could not be analyzed", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("unterminated-heredoc"),
      "--json",
    ]);

    expect(exitCode).toBe(2);
    const report = parseReport(stdout);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].file).toBe("Dockerfile");
    expect(report.failures[0].message).toContain("Unterminated heredoc");
  });
});

describe("Compose merge tags", () => {
  test("a file that uses !reset and !override scans without writing to stderr", async () => {
    const { exitCode, stderr, stdout } = await runCli([
      fixture("compose-merge-tags"),
      "--json",
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(0);

    // web sets its limits under !override, so only worker is reported.
    const report = parseReport(stdout);
    expect(report.failures).toEqual([]);
    expect(report.diagnostics.map((d) => d.rule)).toEqual([
      "docker-doctor/require-resource-limits",
    ]);
  });
});

describe("unreadable directories", () => {
  // chmod 000 does not stop root, and Windows has no POSIX modes.
  const canTestPermissions =
    process.platform !== "win32" && process.getuid?.() !== 0;

  test.skipIf(!canTestPermissions)(
    "an unreadable subdirectory is skipped with a warning and the scan completes",
    async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-unreadable-"));
      const locked = path.join(root, "locked");

      try {
        for (const dir of ["ok", "locked"]) {
          fs.mkdirSync(path.join(root, dir));
          fs.writeFileSync(
            path.join(root, dir, "Dockerfile"),
            'FROM node:22-alpine\nUSER node\nCMD ["node"]\n'
          );
        }

        fs.chmodSync(locked, 0o000);

        const { exitCode, stderr, stdout } = await runCli([root, "--json"]);

        expect(exitCode).toBe(0);
        expect(stderr).toContain("skipped unreadable directory locked");
        expect(parseReport(stdout).project.dockerfiles).toEqual([
          "ok/Dockerfile",
        ]);
      } finally {
        fs.chmodSync(locked, 0o700);
        fs.rmSync(root, { force: true, recursive: true });
      }
    }
  );
});

describe("agent-stack fixture", () => {
  test("reports the interpolated socket mount and the provider-syntax model", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("agent-stack"),
      "--json",
    ]);

    expect(exitCode).toBe(1);
    const report = parseReport(stdout);

    const findings = report.diagnostics.map(
      (d: { rule: string; line?: number }) => [d.rule, d.line]
    );

    expect(findings).toEqual([
      ["docker-doctor/no-docker-socket-mount", 11],
      ["docker-doctor/pin-model-version", 27],
    ]);
  });
});

describe("--json contract", () => {
  test("with-error fixture produces parseable JSON", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    expect(() => parseReport(stdout)).not.toThrow();
  });

  test("report has exactly the documented top-level keys", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = parseReport(stdout);
    expect(Object.keys(report).toSorted()).toEqual(
      [
        "analyzedFiles",
        "diagnostics",
        "failures",
        "label",
        "project",
        "schemaVersion",
        "score",
        "timestamp",
      ].toSorted()
    );
  });

  test("schemaVersion is 6 and analyzedFiles counts the scanned files", async () => {
    const { stdout } = await runCli([fixture("multi-file"), "--json"]);
    const report = parseReport(stdout);
    expect(report.schemaVersion).toBe(6);
    expect(report.analyzedFiles).toBe(2);
  });

  test("a complete scan reports an empty failures list", async () => {
    const { stdout } = await runCli([fixture("clean"), "--json"]);
    const report = parseReport(stdout);
    expect(report.failures).toEqual([]);
  });

  test("score is a number in [0, 100]", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = parseReport(stdout);
    expect(report.score).toBeTypeOf("number");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("every diagnostic has the required shape", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = parseReport(stdout);
    expect(Array.isArray(report.diagnostics)).toBe(true);

    for (const d of report.diagnostics) {
      expect(d.file).toBeTypeOf("string");
      expect(d.help).toBeTypeOf("string");
      expect(d.message).toBeTypeOf("string");
      expect(d.rule).toBeTypeOf("string");
      expect(["error", "warning", "info"]).toContain(d.severity);
      expect([
        "Security",
        "Performance",
        "Best Practices",
        "Compose",
        "Image Size",
      ]).toContain(d.category);
    }
  });

  test("at least one diagnostic has severity error", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = parseReport(stdout);
    expect(
      report.diagnostics.some(
        (d: { severity: string }) => d.severity === "error"
      )
    ).toBe(true);
  });
});

describe("--score contract", () => {
  test("clean fixture prints only an integer score", async () => {
    const { stdout } = await runCli([fixture("clean"), "--score"]);
    const trimmed = stdout.trim();
    expect(Number.isInteger(Number(trimmed))).toBe(true);
    expect(trimmed.split("\n")).toHaveLength(1);
  });

  test("clean fixture score is >= 50", async () => {
    const { stdout } = await runCli([fixture("clean"), "--score"]);
    expect(Number(stdout.trim())).toBeGreaterThanOrEqual(50);
  });

  test("--score exits 1 when an error-severity diagnostic is present", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("with-error"),
      "--score",
    ]);

    expect(exitCode).toBe(1);
    expect(Number.isInteger(Number(stdout.trim()))).toBe(true);
  });

  test("--score exits 0 for a low score with no error-severity diagnostics", async () => {
    // The same project must pass or fail identically in every output mode;
    // score alone never drives the exit code.
    const { exitCode, stdout } = await runCli([
      fixture("low-score-no-errors"),
      "--score",
    ]);

    expect(Number(stdout.trim())).toBeLessThan(50);
    expect(exitCode).toBe(0);
  });
});

describe("analyzed files", () => {
  // The Dockerfile has 3 warnings and 2 infos. compose.yaml has 2 warnings.
  // The penalty of 22 averaged over 2 files is 11, which scores 85.
  const MULTI_FILE_SCORE = "85";

  test("a multi-file project scores the average over its files", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("multi-file"),
      "--score",
    ]);

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe(MULTI_FILE_SCORE);
  });

  test("files with nothing to check do not raise the score", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-stubs-"));

    try {
      fs.cpSync(fixture("multi-file"), root, { recursive: true });

      const stubs = {
        "Dockerfile.empty": "",
        "Dockerfile.notes": "# notes only\n",
        "compose.braces.yaml": "{}\n",
        "compose.empty.yaml": "",
        "compose.list.yaml": "- web\n",
      };

      for (const [name, content] of Object.entries(stubs)) {
        fs.writeFileSync(path.join(root, name), content);
      }

      const { exitCode, stdout } = await runCli([root, "--score"]);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe(MULTI_FILE_SCORE);
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  test("no analyzed file gives a null score in --json and no --score output", async () => {
    const json = await runCli([fixture("all-broken"), "--json"]);
    expect(json.exitCode).toBe(2);
    const report = parseReport(json.stdout);
    expect(report.score).toBeNull();
    expect(report.label).toBeNull();
    expect(report.analyzedFiles).toBe(0);
    expect(report.failures).toHaveLength(2);

    const score = await runCli([fixture("all-broken"), "--score"]);
    expect(score.exitCode).toBe(2);
    expect(score.stdout).toBe("");
    expect(score.stderr).toContain("checked none of the 2 discovered files");
  });

  test("files with nothing to check give no score and exit 0", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-stub-only-"));

    try {
      fs.writeFileSync(path.join(root, "Dockerfile"), "# TODO\n");
      fs.writeFileSync(path.join(root, "compose.yaml"), "{}\n");

      const { exitCode, stderr, stdout } = await runCli([root, "--json"]);
      expect(exitCode).toBe(0);
      const report = parseReport(stdout);
      expect(report.score).toBeNull();
      expect(report.failures).toEqual([]);
      expect(stderr).toContain("checked none of the 2 discovered files");
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  test("failures are listed in discovery order", async () => {
    // The files are read in parallel. Larger files finish reading later, so
    // with the largest file first a scan that kept completion order would
    // list the failures out of order.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-order-"));
    const fileCount = 12;
    const paddingLine = `# ${"x".repeat(78)}\n`;
    const broken = 'services:\n  web:\n    ports: [ "80:80"\n';

    try {
      const expected: string[] = [];

      for (let index = 1; index <= fileCount; index += 1) {
        const dir = `s${String(index).padStart(2, "0")}`;
        fs.mkdirSync(path.join(root, dir));
        fs.writeFileSync(
          path.join(root, dir, "compose.yaml"),
          paddingLine.repeat((fileCount + 1 - index) * 200) + broken
        );
        expected.push(`${dir}/compose.yaml`);
      }

      const { exitCode, stdout } = await runCli([root, "--json"]);
      expect(exitCode).toBe(2);
      const report = parseReport(stdout);
      expect(report.project.composeFiles).toEqual(expected);
      expect(report.failures.map((f: { file: string }) => f.file)).toEqual(
        expected
      );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });
});

describe("empty project", () => {
  test("scanning an empty directory with --json exits 0 with no diagnostics", async () => {
    const { exitCode, stdout } = await runCli([fixture("empty"), "--json"]);
    expect(exitCode).toBe(0);
    const report = parseReport(stdout);
    expect(report.diagnostics).toEqual([]);
  });

  test("--json and --score warn on stderr and report no score", async () => {
    const json = await runCli([fixture("empty"), "--json"]);
    expect(json.exitCode).toBe(0);
    expect(json.stderr).toContain("No Dockerfiles or Compose files found");
    const report = parseReport(json.stdout);
    expect(report.score).toBeNull();
    expect(report.label).toBeNull();
    expect(report.analyzedFiles).toBe(0);

    const score = await runCli([fixture("empty"), "--score"]);
    expect(score.exitCode).toBe(0);
    expect(score.stderr).toContain("No Dockerfiles or Compose files found");
    expect(score.stdout).toBe("");
  });

  test("a project with files gets no such warning", async () => {
    const { stderr } = await runCli([fixture("clean"), "--json"]);
    expect(stderr).not.toContain("No Dockerfiles or Compose files found");
  });

  test("a sibling <name>.dockerignore is never scanned as a Dockerfile", async () => {
    const { stdout } = await runCli([
      fixture("dockerignore-sibling"),
      "--json",
    ]);

    const report = parseReport(stdout);
    expect(report.project.dockerfiles).toEqual(["Dockerfile"]);
    expect(report.project.dockerignores).toContain("Dockerfile.dockerignore");
    expect(
      report.diagnostics.some(
        (d: { file: string }) => d.file === "Dockerfile.dockerignore"
      )
    ).toBe(false);
  });
});

describe("categories config", () => {
  test("categories: { Security: error } overrides no-root-user severity and fails the run", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("with-category-config"),
      "--json",
    ]);

    expect(exitCode).toBe(1);
    const report = parseReport(stdout);

    const rootUserDiag = report.diagnostics.find(
      (d: { rule: string }) => d.rule === "docker-doctor/no-root-user"
    );

    expect(rootUserDiag).toBeDefined();
    expect(rootUserDiag?.severity).toBe("error");
  });
});

describe("--config resolution", () => {
  const packageDir = path.join(import.meta.dir, "..");

  test("resolves relative to the current directory", async () => {
    const { exitCode, stderr } = await runCli(
      [
        fixture("clean"),
        "--json",
        "--config",
        "test/fixtures/with-category-config/docker-doctor.config.yaml",
      ],
      { cwd: packageDir }
    );

    expect(stderr).not.toContain("not found");
    expect(exitCode).toBe(0);
  });

  test("falls back to the scanned directory with a warning", async () => {
    const { exitCode, stderr } = await runCli(
      [
        fixture("with-category-config"),
        "--json",
        "--config",
        "docker-doctor.config.yaml",
      ],
      { cwd: packageDir }
    );

    expect(stderr).toContain("found relative to the scanned directory");
    // The fixture's config escalates no-root-user to error.
    expect(exitCode).toBe(1);
  });

  test("reports a missing config with the cwd-relative path", async () => {
    const { exitCode, stderr } = await runCli(
      [fixture("clean"), "--json", "--config", "does-not-exist.yaml"],
      { cwd: packageDir }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain(
      `Specified config file not found at ${path.join(packageDir, "does-not-exist.yaml")}`
    );
  });
});

describe("scan target validation", () => {
  test("a nonexistent path exits 1 with a plain error", async () => {
    const { exitCode, stderr, stdout } = await runCli([
      fixture("does-not-exist"),
      "--json",
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Directory not found");
    expect(stdout).toBe("");
  });

  test("a file path exits 1 and asks for the directory", async () => {
    const { exitCode, stderr, stdout } = await runCli([
      path.join(fixture("clean"), "Dockerfile"),
      "--json",
    ]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("is not a directory");
    expect(stdout).toBe("");
  });
});

describe("ignore.files config", () => {
  test("ignored files are excluded from the scan and the report", async () => {
    // The vendored/ Dockerfile holds an error-severity finding; ignoring it
    // must remove both the diagnostics and the file from the report.
    const { exitCode, stdout } = await runCli([
      fixture("with-ignore-config"),
      "--json",
    ]);

    expect(exitCode).toBe(0);
    const report = parseReport(stdout);
    expect(report.project.dockerfiles).toEqual(["Dockerfile"]);
    expect(
      report.diagnostics.some((d: { file: string }) =>
        d.file.startsWith("vendored/")
      )
    ).toBe(false);
  });
});

describe("unknown config keys", () => {
  test("warns on stderr without breaking the --json stdout contract", async () => {
    const { exitCode, stderr, stdout } = await runCli([
      fixture("with-unknown-config-keys"),
      "--json",
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toContain('Unknown rule "docker-doctor/no-root-users"');
    expect(stderr).toContain('Unknown category "security"');
    expect(() => parseReport(stdout)).not.toThrow();
  });
});

describe("TypeScript config", () => {
  test("loads docker-doctor.config.ts on a runtime that strips types", async () => {
    const { exitCode, stdout } = await runCli([fixture("ts-config"), "--json"]);

    expect(exitCode).toBe(0);
    const report = parseReport(stdout);
    expect(
      report.diagnostics.some(
        (d: { rule: string }) => d.rule === "docker-doctor/require-labels"
      )
    ).toBe(false);
  });

  test("explains the failure when the runtime cannot import .ts", async () => {
    const { exitCode, stderr } = await runCli(
      [fixture("ts-config"), "--json"],
      { env: { NODE_OPTIONS: "--no-experimental-strip-types" } }
    );

    expect(exitCode).toBe(1);
    expect(stderr).toContain("not stripping TypeScript types");
    expect(stderr).toContain("--no-experimental-strip-types");
  });
});

const RULES_OFF = '{ rules: { "docker-doctor/require-labels": "off" } }';

const scanWithConfig = async (
  dirPrefix: string,
  configFile: string,
  configSource: string
) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), dirPrefix));

  try {
    fs.writeFileSync(path.join(root, "Dockerfile"), "FROM alpine:3.20\n");
    fs.writeFileSync(path.join(root, configFile), configSource);

    return await runCli([root, "--json"]);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};

const reportsRequireLabels = (stdout: string): boolean =>
  parseReport(stdout).diagnostics.some(
    (d: { rule: string }) => d.rule === "docker-doctor/require-labels"
  );

describe("JavaScript config", () => {
  const configCases = [
    {
      file: "docker-doctor.config.mjs",
      source: `export default ${RULES_OFF};`,
    },
    {
      file: "docker-doctor.config.cjs",
      source: `module.exports = ${RULES_OFF};`,
    },
    {
      file: "docker-doctor.config.js",
      source: `module.exports = ${RULES_OFF};`,
    },
  ];

  test.each(configCases)("loads $file", async ({ file, source }) => {
    const { exitCode, stderr, stdout } = await scanWithConfig(
      "dd-jsconfig-",
      file,
      source
    );

    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(reportsRequireLabels(stdout)).toBe(false);
  });

  // `#` and `%` are URL syntax, so import() of a bare path under a directory
  // named like this fails with "Cannot find module".
  test("loads a config from a directory whose name has URL characters", async () => {
    const { exitCode, stderr, stdout } = await scanWithConfig(
      "dd-c#-100%-",
      "docker-doctor.config.mjs",
      `export default ${RULES_OFF};`
    );

    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(reportsRequireLabels(stdout)).toBe(false);
  });
});

describe("piped --json output is not truncated", () => {
  test("--json on a piped stdout exits (does not hang) and parses", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("with-error"),
      "--json",
    ]);

    expect(exitCode).toBe(1);
    expect(() => parseReport(stdout)).not.toThrow();
  });

  test("large --json output over a pipe is not truncated", async () => {
    const piped = await runCli([fixture("many-diagnostics"), "--json"]);
    expect(piped.exitCode).toBe(1);
    expect(piped.stdout.length).toBeGreaterThan(65_536);

    const report = parseReport(piped.stdout);
    expect(Array.isArray(report.diagnostics)).toBe(true);
    expect(report.diagnostics.length).toBeGreaterThan(100);

    // Cross-check against a non-piped (file-redirected) run: the
    // diagnostics count must match exactly -- a truncated pipe write
    // would either fail JSON.parse or yield a shorter diagnostics array.
    const outFile = path.join(import.meta.dir, ".large-out.json");

    const redirected = Bun.spawn(
      ["node", CLI, fixture("many-diagnostics"), "--json"],
      {
        stderr: "pipe",
        stdout: Bun.file(outFile),
      }
    );

    await redirected.exited;
    const fileReport = parseReport(await Bun.file(outFile).text());
    await Bun.file(outFile).delete();

    expect(fileReport.diagnostics).toHaveLength(report.diagnostics.length);
  });
});

describe("heredoc fixture", () => {
  test("heredoc fixture with --json yields at least one diagnostic", async () => {
    const { stdout } = await runCli([fixture("heredoc"), "--json"]);
    const report = parseReport(stdout);
    expect(report.diagnostics.length).toBeGreaterThanOrEqual(1);
  });
});

const makeTempDirs = () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dd-home-"));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "dd-project-"));

  return {
    cleanup: () => {
      fs.rmSync(home, { force: true, recursive: true });
      fs.rmSync(project, { force: true, recursive: true });
    },
    // agent-install resolves some agent dirs from env vars before falling
    // back to HOME (CLAUDE_CONFIG_DIR, CODEX_HOME, XDG_CONFIG_HOME). Pin
    // them all inside the temp home, or a developer's real config dirs get
    // written to — and clobbered — by the --global test.
    env: {
      CLAUDE_CONFIG_DIR: "",
      CODEX_HOME: "",
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
    },
    home,
    project,
  };
};

describe("install", () => {
  test("--global installs into HOME and leaves the project untouched", async () => {
    const { home, project, env, cleanup } = makeTempDirs();

    try {
      const { exitCode } = await runCli(
        ["install", "--global", "--agent", "claude-code", "opencode"],
        { cwd: project, env }
      );

      expect(exitCode).toBe(0);
      expect(
        fs.existsSync(
          path.join(home, ".claude", "skills", "docker-doctor", "SKILL.md")
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(home, ".agents", "skills", "docker-doctor", "SKILL.md")
        )
      ).toBe(true);
      expect(fs.readdirSync(project)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("without --global installs into the project and leaves HOME untouched", async () => {
    const { home, project, env, cleanup } = makeTempDirs();

    try {
      const { exitCode } = await runCli(
        ["install", "--agent", "claude-code", "opencode"],
        { cwd: project, env }
      );

      expect(exitCode).toBe(0);
      expect(
        fs.existsSync(
          path.join(project, ".claude", "skills", "docker-doctor", "SKILL.md")
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(project, ".agents", "skills", "docker-doctor", "SKILL.md")
        )
      ).toBe(true);
      expect(fs.readdirSync(home)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("names every installed agent, the universal one included", async () => {
    const { project, env, cleanup } = makeTempDirs();

    try {
      const { exitCode, stdout } = await runCli(
        ["install", "--agent", "universal"],
        { cwd: project, env }
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Universal →");
    } finally {
      cleanup();
    }
  });

  test("non-interactive run without --agent exits 1 with guidance", async () => {
    const { project, env, cleanup } = makeTempDirs();

    try {
      const { exitCode, stderr } = await runCli(["install", "--global"], {
        cwd: project,
        env,
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain("--agent");
    } finally {
      cleanup();
    }
  });
});
