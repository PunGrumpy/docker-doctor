import { getSkillAgentConfig } from "agent-install";

import { isCommandAvailable } from "./is-command-available";

export type LaunchableAgentId = "claude-code" | "codex" | "cursor";

export const LAUNCHABLE_AGENT_IDS: readonly LaunchableAgentId[] = [
  "claude-code",
  "codex",
  "cursor",
];

// CLI agents we can hand off to by launching their binary with the prompt as
// the initial argument, inheriting this terminal — the agent takes over the
// TTY and control returns here when it exits.
export const AGENT_BINARIES: Record<LaunchableAgentId, string> = {
  "claude-code": "claude",
  codex: "codex",
  cursor: "cursor-agent",
};

// Each agent's skip-approvals flag. The handoff exists so the agent can fix
// the issues end-to-end; the user opted in by picking it from the menu.
export const AGENT_AUTO_FLAGS: Record<LaunchableAgentId, readonly string[]> = {
  "claude-code": ["--dangerously-skip-permissions"],
  codex: ["--yolo"],
  cursor: ["--force"],
};

export const getAgentDisplayName = (agentId: LaunchableAgentId): string =>
  getSkillAgentConfig(agentId).displayName;

// Launchable = the agent's CLI binary is on PATH. Windows is excluded: npm
// installs .cmd shims there that `spawn` can only run through a shell, and a
// shell mangles the multi-line prompt — those users get the clipboard path.
export const detectLaunchableAgents = (): LaunchableAgentId[] => {
  if (process.platform === "win32") {
    return [];
  }
  return LAUNCHABLE_AGENT_IDS.filter((agentId) =>
    isCommandAvailable(AGENT_BINARIES[agentId])
  );
};
