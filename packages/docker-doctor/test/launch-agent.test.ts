import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { launchAgent } from "../src/agents/launch-agent";

// A stand-in for the `claude` binary. It records the directory it ran in
// and the arguments it was given, one per line.
const FAKE_AGENT =
  '#!/bin/sh\npwd > launched.txt\nprintf "%s\\n" "$@" >> launched.txt\n';

const withFakeAgentOnPath = async (
  run: (project: string) => Promise<void>,
  options: { installAgent: boolean }
): Promise<void> => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "dd-agent-bin-"));
  // On macOS the temp directory is a symlink and `pwd` prints the resolved
  // path, so the test compares against the real path.
  const project = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "dd-agent-project-"))
  );
  const originalPath = process.env.PATH;
  try {
    if (options.installAgent) {
      fs.writeFileSync(path.join(bin, "claude"), FAKE_AGENT, { mode: 0o755 });
    }
    process.env.PATH = options.installAgent
      ? `${bin}${path.delimiter}${originalPath ?? ""}`
      : bin;
    await run(project);
  } finally {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { force: true, recursive: true });
    fs.rmSync(project, { force: true, recursive: true });
  }
};

// The fake agent is a shell script, and Windows never launches agents (see
// launchable-agents.ts).
describe.skipIf(process.platform === "win32")("launchAgent", () => {
  test("starts the agent in the scanned directory with the prompt last", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        const launched = await launchAgent("claude-code", "fix it", project);

        expect(launched).toBe(true);
        const [cwd, ...args] = fs
          .readFileSync(path.join(project, "launched.txt"), "utf-8")
          .trim()
          .split("\n");
        expect(cwd).toBe(project);
        expect(args).toEqual(["--dangerously-skip-permissions", "fix it"]);
      },
      { installAgent: true }
    );
  });

  test("resolves false when the agent binary cannot be started", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        expect(await launchAgent("claude-code", "fix it", project)).toBe(false);
      },
      { installAgent: false }
    );
  });
});
