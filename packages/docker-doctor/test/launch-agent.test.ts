import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { launchAgent } from "../src/agents/launch-agent";

// A stand-in for the `claude` binary. It records the directory it ran in
// and the arguments it was given, one per line.
const FAKE_AGENT =
  '#!/bin/sh\npwd > launched.txt\nprintf "%s\\n" "$@" >> launched.txt\n';

// A stand-in agent that handles its own signals, as a real one does, and
// keeps working after both. It logs each event to events.txt, writes its pid
// to pid.txt, and runs until release.txt exists. The loop ends by itself
// after ten seconds, so a failing test cannot leave it running.
const SIGNAL_AGENT = `#!/bin/sh
echo $$ > pid.txt
trap 'echo INT >> events.txt' INT
trap 'echo TERM >> events.txt' TERM
echo ready >> events.txt
i=0
while [ ! -f release.txt ] && [ "$i" -lt 200 ]; do sleep 0.05; i=$((i + 1)); done
echo exited >> events.txt
`;

const LAUNCH_AGENT_MODULE = new URL(
  "../src/agents/launch-agent.ts",
  import.meta.url
).href;

const POLL_MS = 20;
const WAIT_MS = 3000;

// Time for this process to run a signal handler after the agent has logged
// the same signal.
const SETTLE_MS = 150;

const readEvents = (project: string): string[] => {
  const file = path.join(project, "events.txt");

  if (!fs.existsSync(file)) {
    return [];
  }

  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .filter((line) => line !== "");
};

const waitFor = async (
  condition: () => boolean,
  description: string,
  deadline = Date.now() + WAIT_MS
): Promise<void> => {
  if (condition()) {
    return;
  }

  if (Date.now() > deadline) {
    throw new Error(`Timed out waiting for ${description}`);
  }

  await sleep(POLL_MS);
  await waitFor(condition, description, deadline);
};

// cli.ts registers these two handlers for the whole scan, and they exit the
// process. The stand-ins record the signal instead, so a handler that runs
// while the agent does shows up in `exits` and does not kill the test runner.
const withScanSignalHandlers = async (
  run: (exits: string[]) => Promise<void>
): Promise<void> => {
  const exits: string[] = [];

  const onSigint = (): void => {
    exits.push("SIGINT");
  };

  const onSigterm = (): void => {
    exits.push("SIGTERM");
  };

  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    await run(exits);
  } finally {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
  }
};

// Starts launchAgent without waiting for it, and records whether it has
// settled.
const launchInBackground = (project: string) => {
  const progress = { settled: false };

  const launched = (async (): Promise<boolean> => {
    const result = await launchAgent("claude-code", "fix it", project);
    progress.settled = true;

    return result;
  })();

  return { launched, progress };
};

const withFakeAgentOnPath = async (
  run: (project: string) => Promise<void>,
  options: { installAgent: boolean; script?: string }
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
      fs.writeFileSync(path.join(bin, "claude"), options.script ?? FAKE_AGENT, {
        mode: 0o755,
      });
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

  test("resolves true when the agent exits with a failure code", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        expect(await launchAgent("claude-code", "fix it", project)).toBe(true);
      },
      { installAgent: true, script: "#!/bin/sh\nexit 3\n" }
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

  test("keeps waiting for the agent when Ctrl-C reaches both processes", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        await withScanSignalHandlers(async (exits) => {
          const listenersBefore = process.listeners("SIGINT");
          const { launched, progress } = launchInBackground(project);
          await waitFor(
            () => readEvents(project).includes("ready"),
            "the agent to start"
          );

          const agentPid = Number(
            fs.readFileSync(path.join(project, "pid.txt"), "utf-8")
          );

          // The terminal sends Ctrl-C to every process in the foreground
          // group, so both this process and the agent get it.
          process.kill(process.pid, "SIGINT");
          process.kill(agentPid, "SIGINT");
          await waitFor(
            () => readEvents(project).includes("INT"),
            "the agent to get SIGINT"
          );
          await sleep(SETTLE_MS);

          expect(exits).toEqual([]);
          expect(progress.settled).toBe(false);

          fs.writeFileSync(path.join(project, "release.txt"), "");

          expect(await launched).toBe(true);
          expect(readEvents(project)).toEqual(["ready", "INT", "exited"]);
          expect(process.listeners("SIGINT")).toEqual(listenersBefore);
        });
      },
      { installAgent: true, script: SIGNAL_AGENT }
    );
  });

  test("passes SIGTERM on to the agent, then to the restored handler once the agent has exited", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        await withScanSignalHandlers(async (exits) => {
          const listenersBefore = process.listeners("SIGTERM");
          const { launched, progress } = launchInBackground(project);
          await waitFor(
            () => readEvents(project).includes("ready"),
            "the agent to start"
          );

          process.kill(process.pid, "SIGTERM");
          await waitFor(
            () => readEvents(project).includes("TERM"),
            "the agent to get SIGTERM"
          );
          await sleep(SETTLE_MS);

          // The agent has the signal and is still working, so the handler
          // that ends docker-doctor must wait.
          expect(exits).toEqual([]);
          expect(progress.settled).toBe(false);

          fs.writeFileSync(path.join(project, "release.txt"), "");

          expect(await launched).toBe(true);
          expect(exits).toEqual(["SIGTERM"]);
          expect(readEvents(project)).toEqual(["ready", "TERM", "exited"]);
          expect(process.listeners("SIGTERM")).toEqual(listenersBefore);
        });
      },
      { installAgent: true, script: SIGNAL_AGENT }
    );
  });

  test("ends the process when SIGTERM arrived during the run and no handler is registered", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        const driver = path.join(project, "driver.mjs");
        fs.writeFileSync(
          driver,
          `import { launchAgent } from ${JSON.stringify(LAUNCH_AGENT_MODULE)};
const launched = launchAgent("claude-code", "fix it", process.cwd());
process.kill(process.pid, "SIGTERM");
await launched;
console.log("survived");
`
        );

        const driverProcess = Bun.spawn([process.execPath, driver], {
          cwd: project,
          env: process.env,
          stderr: "ignore",
          stdout: "pipe",
        });

        await driverProcess.exited;

        expect({
          signal: driverProcess.signalCode,
          stdout: await new Response(driverProcess.stdout).text(),
        }).toEqual({ signal: "SIGTERM", stdout: "" });
      },
      { installAgent: true, script: "#!/bin/sh\nexec sleep 5\n" }
    );
  });

  test("puts the signal handlers back when the agent cannot be started", async () => {
    await withFakeAgentOnPath(
      async (project) => {
        await withScanSignalHandlers(async () => {
          const interruptBefore = process.listeners("SIGINT");
          const terminateBefore = process.listeners("SIGTERM");

          expect(await launchAgent("claude-code", "fix it", project)).toBe(
            false
          );
          expect(process.listeners("SIGINT")).toEqual(interruptBefore);
          expect(process.listeners("SIGTERM")).toEqual(terminateBefore);
        });
      },
      { installAgent: false }
    );
  });
});
