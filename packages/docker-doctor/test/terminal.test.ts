import { beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";

// Characterization tests for the human-readable report. They assert stable
// substrings, not whole output, so restyling does not break them.

const CLI = path.join(import.meta.dir, "..", "dist", "cli.mjs");
const fixture = (name: string) => path.join(import.meta.dir, "fixtures", name);

// CI disables the score animation; NO_COLOR and FORCE_COLOR=0 turn off chalk.
const PLAIN_ENV = { CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" };

const runPlain = async (args: string[]) => {
  const proc = Bun.spawn(["node", CLI, ...args], {
    env: { ...process.env, ...PLAIN_ENV },
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

describe("terminal report", () => {
  test("migration notice counts distinct files", async () => {
    const { stdout } = await runPlain([fixture("low-score-no-errors")]);
    expect(stdout).toMatch(/require-resource-limits ×\d+ across 1 file\b/u);
    expect(stdout).not.toContain("across 15 files");
  });

  test("default output lists category counts and the verbose hint", async () => {
    const { stdout } = await runPlain([fixture("with-error")]);
    expect(stdout).toContain("Security ›");
    expect(stdout).toContain("Run docker-doctor --verbose");
    expect(stdout).toContain("/ 100");
  });

  test("verbose output shows severity prefixes, code frames and help", async () => {
    const { stdout } = await runPlain([fixture("with-error"), "--verbose"]);
    expect(stdout).toContain("ERROR");
    expect(stdout).toContain("│");
    expect(stdout).toContain("Help:");
  });

  test("no ANSI escape sequences when colors are disabled", async () => {
    const [plain, verbose] = await Promise.all([
      runPlain([fixture("with-error")]),
      runPlain([fixture("with-error"), "--verbose"]),
    ]);
    expect(plain.stdout).not.toContain("\u001B");
    expect(verbose.stdout).not.toContain("\u001B");
  });
});
