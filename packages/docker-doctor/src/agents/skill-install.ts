import fs from "node:fs";
import path from "node:path";

import type { SkillAgentType, SkillInstallResult } from "agent-install";
import { SKILL_MANIFEST_FILE, installSkillsFromSource } from "agent-install";

const moduleDir = import.meta.dirname;

// The published package ships the skill at <package root>/skill (copied from
// skills/docker-doctor at build time); when running from the repo the source
// itself is the fallback. Returns null when neither exists.
export const getSkillSourceDirectory = (): string | null => {
  const candidates = [
    // dist/cli.mjs → package root/skill/docker-doctor
    path.resolve(moduleDir, "../skill/docker-doctor"),
    // src/agents/*.ts in the monorepo → repo root/skills/docker-doctor
    path.resolve(moduleDir, "../../../../skills/docker-doctor"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, SKILL_MANIFEST_FILE))) {
      return candidate;
    }
  }
  return null;
};

// Copies the bundled docker-doctor skill into each agent's project-level
// skills dir so the agent already knows the /docker-doctor triage workflow.
// Best-effort: returns null when the bundled skill is missing or the install
// throws — callers treat that as "skill not installed", never as a failure.
export const installSkillForAgents = async (
  agents: SkillAgentType[],
  projectRoot: string
): Promise<SkillInstallResult | null> => {
  const source = getSkillSourceDirectory();
  if (!source) {
    return null;
  }
  try {
    return await installSkillsFromSource({
      agents,
      cwd: projectRoot,
      mode: "copy",
      source,
    });
  } catch {
    return null;
  }
};
