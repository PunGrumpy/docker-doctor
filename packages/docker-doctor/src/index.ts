import packageJson from "../package.json" with { type: "json" };

// Re-export core programmatic API
export {
  discoverProject,
  parseDockerfile,
  parseCompose,
  runDockerfileRules,
  runComposeRules,
  isAnalyzableDockerfile,
  isAnalyzableCompose,
  calculateScore,
  defineConfig,
  loadConfig,
  allRules,
  findRule,
  toJsonReport,
} from "@docker-doctor/core";
export type {
  ComposeMapping,
  ComposeValue,
  Diagnostic,
  DockerDoctorConfig,
  RuleCategory,
  RuleSeverity,
  ScoreResult,
} from "@docker-doctor/core";
export const version: string = packageJson.version;
