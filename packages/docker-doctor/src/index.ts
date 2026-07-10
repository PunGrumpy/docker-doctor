import packageJson from "../package.json" with { type: "json" };

// Re-export core programmatic API
export {
  discoverProject,
  parseDockerfile,
  parseCompose,
  runDockerfileRules,
  runComposeRules,
  calculateScore,
  loadConfig,
  allRules,
  findRule,
  toJsonReport,
} from "@docker-doctor/core";
export type { Diagnostic, RuleSeverity } from "@docker-doctor/core";
export const { version } = packageJson;
