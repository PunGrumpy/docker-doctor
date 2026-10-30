import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";

import type { LaunchableAgentId } from "./launchable-agents";
import { AGENT_AUTO_FLAGS, AGENT_BINARIES } from "./launchable-agents";

const SIGNALS_HANDED_OVER = ["SIGINT", "SIGTERM"] as const;

const ignoreInterrupt = (): void => undefined;

// A SIGTERM that arrived while the agent ran has to end this process once the
// agent is gone. emit runs the restored handlers now. A signal raised with
// kill would reach them only if the event loop gets another turn, and the
// CLI can finish first. With no handler to run, kill lets the default action
// end the process.
const deliverTerminate = (): void => {
  if (process.listenerCount("SIGTERM") === 0) {
    process.kill(process.pid, "SIGTERM");

    return;
  }

  process.emit("SIGTERM", "SIGTERM");
};

// The agent owns the terminal while it runs. The terminal sends Ctrl-C to the
// whole foreground process group, so the agent gets its own SIGINT and
// decides what to do with it. If this process exited on the same signal, the
// agent would carry on without a parent and compete with the shell for the
// terminal. So until the agent exits, SIGINT is ignored here, SIGTERM is
// passed on to the agent, and the handlers the scan registered (cli.ts exits
// on both) are set aside. The returned function puts them back, then delivers
// a SIGTERM that arrived meanwhile to them, so docker-doctor still ends with
// 143.
const handOverSignals = (child: ChildProcess): (() => void) => {
  let terminated = false;

  const passOnTerminate = (): void => {
    terminated = true;
    child.kill("SIGTERM");
  };

  const setAside = SIGNALS_HANDED_OVER.flatMap((signal) =>
    process.listeners(signal).map((listener) => ({ listener, signal }))
  );

  // Ours go in before the others come out, so there is never a moment
  // without a handler, where the default action would end this process.
  process.on("SIGINT", ignoreInterrupt);
  process.on("SIGTERM", passOnTerminate);

  for (const { listener, signal } of setAside) {
    process.removeListener(signal, listener);
  }

  return () => {
    for (const { listener, signal } of setAside) {
      process.on(signal, listener);
    }

    process.removeListener("SIGINT", ignoreInterrupt);
    process.removeListener("SIGTERM", passOnTerminate);

    if (terminated) {
      deliverTerminate();
    }
  };
};

// Launches the agent's CLI with the prompt as its initial argument, handing it
// this terminal. The agent starts in `cwd`, the scanned directory. Every path
// in the prompt is relative to it, and the shell's own directory can be a
// different project. Resolves true once the agent exits, whatever its exit
// code, and false when it could not be started (the caller falls back to the
// clipboard path).
export const launchAgent = async (
  agentId: LaunchableAgentId,
  prompt: string,
  cwd: string
): Promise<boolean> => {
  const child = spawn(
    AGENT_BINARIES[agentId],
    [...AGENT_AUTO_FLAGS[agentId], prompt],
    { cwd, stdio: "inherit" }
  );

  const restoreSignals = handOverSignals(child);

  try {
    await once(child, "exit");
  } catch {
    return false;
  } finally {
    restoreSignals();
  }

  return true;
};
