import packageJson from "../package.json" with { type: "json" };

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
  fingerprintDiagnostics,
  toJsonReport,
} from "@docker-doctor/core";

export type {
  ComposeMapping,
  ComposeValue,
  Diagnostic,
  DockerDoctorConfig,
  FingerprintedDiagnostic,
  JsonReport,
  ReportInput,
  RuleCategory,
  RuleSeverity,
  ScoreResult,
} from "@docker-doctor/core";

export const version: string = packageJson.version;
