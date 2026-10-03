import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Runs the shell of action.yml's scan step against a stand-in for `npx`, so
// the tests can assert what the step prints and writes without a GitHub
// runner.
const ACTION_FILE = path.join(import.meta.dir, "..", "action.yml");
const RUN_INDENT = "        ";

// The block scalar under `run: |` of the step with `id: scan`.
const scanStepScript = (): string => {
  const lines = fs.readFileSync(ACTION_FILE, "utf-8").split("\n");
  const start = lines.indexOf("      run: |", lines.indexOf("      id: scan"));
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line !== "" && !line.startsWith(RUN_INDENT)) {
      break;
    }
    body.push(line.slice(RUN_INDENT.length));
  }
  return body.join("\n");
};

const runScanStep = async (fakeNpx: string) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dd-action-"));
  try {
    fs.writeFileSync(path.join(temp, "npx"), fakeNpx, { mode: 0o755 });
    const outputFile = path.join(temp, "github-output");
    fs.writeFileSync(outputFile, "");
    const proc = Bun.spawn(["bash", "-c", scanStepScript()], {
      env: {
        ...process.env,
        GITHUB_OUTPUT: outputFile,
        INPUT_CONFIG: "",
        INPUT_DIRECTORY: ".",
        INPUT_VERSION: "latest",
        PATH: `${temp}${path.delimiter}${process.env.PATH ?? ""}`,
        RUNNER_TEMP: temp,
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return {
      exitCode,
      outputs: fs.readFileSync(outputFile, "utf-8"),
      stdout,
    };
  } finally {
    fs.rmSync(temp, { force: true, recursive: true });
  }
};

// The step runs under bash, which Windows runners provide but a Windows
// developer machine may not.
describe.skipIf(process.platform === "win32")("action.yml scan step", () => {
  test("prints the CLI's stderr even when a report was written", async () => {
    const { exitCode, outputs, stdout } = await runScanStep(
      '#!/bin/sh\necho \'{"diagnostics":[]}\'\necho "Warning: Unknown rule \\"docker-doctor/nope\\" in config" >&2\nexit 2\n'
    );

    expect(exitCode).toBe(0);
    expect(outputs).toContain("exit-status=2");
    expect(stdout).toContain('Warning: Unknown rule "docker-doctor/nope"');
    expect(stdout).not.toContain("without producing a JSON report");
  });

  test("switches workflow commands off while the stderr prints", async () => {
    const { stdout } = await runScanStep(
      '#!/bin/sh\necho "{}"\necho "::error::forged by a scanned file" >&2\n'
    );
    const lines = stdout.split("\n");
    const stop = lines.findIndex((line) =>
      line.startsWith("::stop-commands::")
    );
    const forged = lines.indexOf("::error::forged by a scanned file");
    const token = lines[stop].slice("::stop-commands::".length);
    const resume = lines.indexOf(`::${token}::`);

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(stop).toBeGreaterThan(-1);
    expect(forged).toBeGreaterThan(stop);
    expect(resume).toBeGreaterThan(forged);
  });

  test("still warns when no report was produced", async () => {
    const { exitCode, outputs, stdout } = await runScanStep(
      '#!/bin/sh\necho "npm error 404" >&2\nexit 1\n'
    );

    expect(exitCode).toBe(0);
    expect(outputs).toContain("exit-status=1");
    expect(stdout).toContain("without producing a JSON report");
    expect(stdout).toContain("npm error 404");
  });

  test("prints nothing extra when the CLI was quiet", async () => {
    const { stdout } = await runScanStep('#!/bin/sh\necho "{}"\n');

    expect(stdout).not.toContain("::group::");
  });
});
