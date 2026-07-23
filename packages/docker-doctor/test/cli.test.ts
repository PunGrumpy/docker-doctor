import { beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";

const CLI = path.join(import.meta.dir, "..", "dist", "cli.mjs");
const fixture = (name: string) => path.join(import.meta.dir, "fixtures", name);

const runCli = async (args: string[]) => {
  const proc = Bun.spawn(["node", CLI, ...args], {
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
