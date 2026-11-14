import { beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";

// Runs the built CLI on a pseudo-terminal, the way a person starts it. The
// piped runs in the other test files never take the interactive path.

const CLI = path.join(import.meta.dir, "..", "dist", "cli.mjs");
const fixture = (name: string) => path.join(import.meta.dir, "fixtures", name);

const TERMINAL_COLUMNS = 100;
const TERMINAL_ROWS = 40;
const RUN_TIMEOUT_MS = 10_000;
const TEST_TIMEOUT_MS = 15_000;

// CI skips the score animation so the output settles at once.
const STILL_ENV = { CI: "1" };

// Each test sets the color variables it means, so the shell's own do not leak in.
const COLOR_VARIABLES = new Set(["NO_COLOR", "FORCE_COLOR"]);

const BASE_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !COLOR_VARIABLES.has(name))
);

const SCAN_SUMMARY =
  /Scanned (?<count>\d+) (?<noun>files?) in \d+\.\ds(?<rest>.*)/u;

const SCORE_BOX = /\/ 100/u;
const ESCAPE = String.fromCodePoint(0x1b);
const COLOR_SEQUENCE = new RegExp(`${ESCAPE}\\[[\\d;]*m`, "u");

const decoder = new TextDecoder();

// The handoff prompt after the report waits for a key press, so the CLI
// never exits by itself. Stop it once the output the test needs has arrived.
const runOnTerminal = async (
  args: string[],
  until: RegExp,
  env: Record<string, string> = {}
): Promise<string> => {
  let output = "";
  const matched = Promise.withResolvers<boolean>();

  const proc = Bun.spawn(["node", CLI, ...args], {
    env: { ...BASE_ENV, ...STILL_ENV, ...env },
    terminal: {
      cols: TERMINAL_COLUMNS,
      data: (_terminal, data) => {
        output += decoder.decode(data, { stream: true });

        if (until.test(output)) {
          matched.resolve(true);
        }
      },
      rows: TERMINAL_ROWS,
    },
  });

  await Promise.race([matched.promise, Bun.sleep(RUN_TIMEOUT_MS)]);

  proc.kill("SIGKILL");
  await proc.exited;
  proc.terminal?.close();

  return output;
};

beforeAll(async () => {
  const exists = await Bun.file(CLI).exists();

  if (!exists) {
    throw new Error(
      `Built CLI not found at ${CLI}. Run: bun run build --filter @docker-doctor/cli`
    );
  }
});

describe("interactive scan summary", () => {
  test(
    "reports the file count and the duration, with no worker count",
    async () => {
      const output = await runOnTerminal([fixture("multi-file")], SCAN_SUMMARY);
      const summary = SCAN_SUMMARY.exec(output)?.groups;

      expect(summary?.count).toBe("2");
      expect(summary?.noun).toBe("files");
      expect(summary?.rest).toBe("");
      expect(output).not.toContain("workers");
    },
    TEST_TIMEOUT_MS
  );

  test(
    "says 1 file for a single file",
    async () => {
      const output = await runOnTerminal([fixture("with-error")], SCAN_SUMMARY);
      const summary = SCAN_SUMMARY.exec(output)?.groups;

      expect(summary?.count).toBe("1");
      expect(summary?.noun).toBe("file");
    },
    TEST_TIMEOUT_MS
  );
});

const colorFor = async (env: Record<string, string>): Promise<boolean> => {
  const output = await runOnTerminal([fixture("multi-file")], SCORE_BOX, env);

  // Without a rendered report there is nothing to judge, so fail instead of
  // reporting "no color".
  expect(output).toMatch(SCORE_BOX);

  return COLOR_SEQUENCE.test(output);
};

describe("interactive color", () => {
  test(
    "FORCE_COLOR alone colors the report",
    async () => {
      expect(await colorFor({ FORCE_COLOR: "1" })).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "NO_COLOR turns color off even when FORCE_COLOR asks for it",
    async () => {
      expect(await colorFor({ FORCE_COLOR: "1", NO_COLOR: "1" })).toBe(false);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "NO_COLOR counts whatever its value is",
    async () => {
      expect(await colorFor({ FORCE_COLOR: "1", NO_COLOR: "0" })).toBe(false);
    },
    TEST_TIMEOUT_MS
  );

  test(
    "an empty NO_COLOR is ignored",
    async () => {
      expect(await colorFor({ FORCE_COLOR: "1", NO_COLOR: "" })).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
