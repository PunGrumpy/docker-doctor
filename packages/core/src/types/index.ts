export interface DockerfileInstruction {
  instruction: string;
  args: string;
  line: number;
  raw: string;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  file: string;
  rule: string;
  severity: DiagnosticSeverity;
  message: string;
  help: string;
  line?: number;
  column?: number;
}

export interface ProjectInfo {
  dockerfiles: string[];
  composeFiles: string[];
  dockerignores?: string[];
}

export interface DiagnoseResult {
  score: number;
  label: string;
  diagnostics: Diagnostic[];
  project: ProjectInfo;
}

export type RuleCategory =
  | "Security"
  | "Performance"
  | "Best Practices"
  | "Compose"
  | "Image Size";
export type RuleSeverity = DiagnosticSeverity | "off";

export interface RuleDefinition {
  key: string;
  category: RuleCategory;
  // "off" is a config-only severity: a rule's own default is always emitting.
  defaultSeverity: DiagnosticSeverity;
  message: string;
  help: string;
}

export interface DockerfileRule extends RuleDefinition {
  /**
   * `instructions` is the complete instruction list of one Dockerfile, in
   * file order — rules may rely on ordering (e.g. stage-level state).
   */
  check: (
    instructions: DockerfileInstruction[],
    file: string,
    context?: { projectFiles?: string[] }
  ) => Diagnostic[];
}

/**
 * Maps a path of YAML keys/indices (e.g. `["services", "web"]`) to the
 * 1-based line where that key is defined, or `undefined` when the path does
 * not resolve to a concrete node in the source document.
 */
export type ComposeLocator = (
  path: readonly (string | number)[]
) => number | undefined;

export interface ComposeRule extends RuleDefinition {
  check: (
    composeContent: unknown,
    file: string,
    context?: { locate?: ComposeLocator }
  ) => Diagnostic[];
}

export interface DockerDoctorConfig {
  rules?: Record<string, RuleSeverity>;
  categories?: Partial<Record<RuleCategory, RuleSeverity>>;
  ignore?: {
    files?: string[];
  };
}
