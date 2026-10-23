import { spawn } from "node:child_process";
import { once } from "node:events";

import type { LaunchableAgentId } from "./launchable-agents";
import { AGENT_AUTO_FLAGS, AGENT_BINARIES } from "./launchable-agents";

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

  try {
    await once(child, "exit");
  } catch {
    return false;
  }

  return true;
};
