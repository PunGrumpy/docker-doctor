import packageJson from "../package.json" with { type: "json" };

// Re-export core programmatic API
export {
  discoverProject,
  parseDockerfile,
  parseCompose,
  runDockerfileRules,
  runComposeRules,
  calculateScore,
  defineConfig,
  loadConfig,
  allRules,
  findRule,
  toJsonReport,
} from "@docker-doctor/core";
export type {
  Diagnostic,
  DockerDoctorConfig,
  RuleCategory,
  RuleSeverity,
} from "@docker-doctor/core";
export const { version } = packageJson;
