export interface DockerfileInstruction {
  instruction: string;
  args: string;
  line: number;
  raw: string;
}

export interface Diagnostic {
  file: string;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  help: string;
  line?: number;
  column?: number;
}

export interface ProjectInfo {
  dockerfiles: string[];
  composeFiles: string[];
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
export type RuleSeverity = "error" | "warning" | "info" | "off";

export interface RuleDefinition {
  key: string;
  category: RuleCategory;
  defaultSeverity: RuleSeverity;
  message: string;
  help: string;
}

export interface DockerfileRule extends RuleDefinition {
  check: (
    instructions: DockerfileInstruction[],
    file: string,
    context?: { projectFiles?: string[] }
  ) => Diagnostic[];
}

export interface ComposeRule extends RuleDefinition {
  check: (composeContent: unknown, file: string) => Diagnostic[];
}

export interface DockerDoctorConfig {
  rules?: Record<string, RuleSeverity>;
  categories?: Record<RuleCategory, RuleSeverity>;
  ignore?: {
    files?: string[];
  };
}
