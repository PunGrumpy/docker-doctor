export { discoverProject } from "./project-info/discover";

export { parseDockerfile } from "./parsers/dockerfile-parser";

export { createComposeLocator, parseCompose } from "./parsers/compose-parser";

export { runDockerfileRules } from "./runners/dockerfile-runner";

export { runComposeRules } from "./runners/compose-runner";

export {
  isAnalyzableCompose,
  isAnalyzableDockerfile,
} from "./runners/analyzable";

export {
  allRules,
  allDockerfileRules,
  allComposeRules,
  findRule,
} from "./rules/index";

export { defineConfig } from "./config/define-config";

export { loadConfig } from "./config/loader";

export {
  collectUnknownConfigKeys,
  type UnknownConfigKeys,
} from "./config/unknown-keys";

export {
  calculateScore,
  getScoreBucket,
  SCORE_BUCKETS,
  type ScoreResult,
} from "./scoring";

export {
  ConfigError,
  type DockerDoctorError,
  FileNotFoundError,
  ParseError,
} from "./errors";

export type {
  ComposeLocator,
  ComposeMapping,
  ComposeRule,
  ComposeValue,
  DiagnoseResult,
  Diagnostic,
  DiagnosticSeverity,
  DockerDoctorConfig,
  DockerfileInstruction,
  DockerfileRule,
  ProjectInfo,
  RuleCategory,
  RuleDefinition,
  RuleSeverity,
} from "./types/index";

export { toJsonReport, type JsonReport } from "./report";
