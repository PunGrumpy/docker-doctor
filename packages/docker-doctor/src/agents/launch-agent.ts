import { spawn } from "node:child_process";

import type { LaunchableAgentId } from "./launchable-agents";
import { AGENT_AUTO_FLAGS, AGENT_BINARIES } from "./launchable-agents";

// Launches the agent's CLI with the prompt as its initial argument, handing it
// this terminal. Resolves true when the agent process exits normally, false
// when it could not be started (caller falls back to the clipboard path).
export const launchAgent = (
  agentId: LaunchableAgentId,
  prompt: string
): Promise<boolean> =>
  /* eslint-disable promise/avoid-new */
  new Promise((resolve) => {
    const child = spawn(
      AGENT_BINARIES[agentId],
      [...AGENT_AUTO_FLAGS[agentId], prompt],
      { stdio: "inherit" }
    );
    child.once("error", () => {
      resolve(false);
    });
    child.once("exit", () => {
      resolve(true);
    });
  });
/* eslint-enable promise/avoid-new */
