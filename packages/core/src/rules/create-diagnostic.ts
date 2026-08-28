import type { Diagnostic, DiagnosticSeverity } from "../types/index";

export const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: DiagnosticSeverity,
  message: string,
  help: string,
  line?: number
): Diagnostic => ({ file, help, line, message, rule: ruleKey, severity });
