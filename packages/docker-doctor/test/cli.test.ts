import { beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLI = path.join(import.meta.dir, "..", "dist", "cli.mjs");
const fixture = (name: string) => path.join(import.meta.dir, "fixtures", name);

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
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("--score still prints only an integer, but exits 2", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("unparseable-compose"),
      "--score",
    ]);
    expect(exitCode).toBe(2);
    expect(Number.isInteger(Number(stdout.trim()))).toBe(true);
    expect(stdout.trim().split("\n").length).toBe(1);
  });
});

describe("--json contract", () => {
  test("with-error fixture produces parseable JSON", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("report has exactly the documented top-level keys", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = JSON.parse(stdout);
    expect(Object.keys(report).toSorted()).toEqual(
      [
        "diagnostics",
        "label",
        "project",
        "schemaVersion",
        "score",
        "timestamp",
      ].toSorted()
    );
  });

  test("score is a number in [0, 100]", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = JSON.parse(stdout);
    expect(typeof report.score).toBe("number");
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("every diagnostic has the required shape", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = JSON.parse(stdout);
    expect(Array.isArray(report.diagnostics)).toBe(true);
    for (const d of report.diagnostics) {
      expect(typeof d.file).toBe("string");
      expect(typeof d.help).toBe("string");
      expect(typeof d.message).toBe("string");
      expect(typeof d.rule).toBe("string");
      expect(["error", "warning", "info"]).toContain(d.severity);
    }
  });

  test("at least one diagnostic has severity error", async () => {
    const { stdout } = await runCli([fixture("with-error"), "--json"]);
    const report = JSON.parse(stdout);
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
    expect(trimmed.split("\n").length).toBe(1);
  });

  test("clean fixture score is >= 50", async () => {
    const { stdout } = await runCli([fixture("clean"), "--score"]);
    expect(Number(stdout.trim())).toBeGreaterThanOrEqual(50);
  });
});

describe("empty project", () => {
  test("scanning an empty directory with --json exits 0 with no diagnostics", async () => {
    const { exitCode, stdout } = await runCli([fixture("empty"), "--json"]);
    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.diagnostics).toEqual([]);
  });
});

describe("categories config", () => {
  test("categories: { Security: error } overrides no-root-user severity and fails the run", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("with-category-config"),
      "--json",
    ]);
    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout);
    const rootUserDiag = report.diagnostics.find(
      (d: { rule: string }) => d.rule === "docker-doctor/no-root-user"
    );
    expect(rootUserDiag).toBeDefined();
    expect(rootUserDiag.severity).toBe("error");
  });
});

describe("piped --json output is not truncated", () => {
  test("--json on a piped stdout exits (does not hang) and parses", async () => {
    const { exitCode, stdout } = await runCli([
      fixture("with-error"),
      "--json",
    ]);
    expect(exitCode).toBe(1);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  test("large --json output over a pipe is not truncated", async () => {
    const piped = await runCli([fixture("many-diagnostics"), "--json"]);
    expect(piped.exitCode).toBe(1);
    expect(piped.stdout.length).toBeGreaterThan(65_536);

    const report = JSON.parse(piped.stdout);
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
    const fileReport = JSON.parse(await Bun.file(outFile).text());
    await Bun.file(outFile).delete();

    expect(fileReport.diagnostics.length).toBe(report.diagnostics.length);
  });
});

describe("heredoc fixture", () => {
  test("heredoc fixture with --json yields at least one diagnostic", async () => {
    const { stdout } = await runCli([fixture("heredoc"), "--json"]);
    const report = JSON.parse(stdout);
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
