import type { Diagnostic, ProjectInfo } from "./types/index.js";

export interface JsonReport {
  diagnostics: {
    column?: number;
    file: string;
    help: string;
    line?: number;
    message: string;
    rule: string;
    severity: "error" | "warning" | "info";
  }[];
  label: string;
  project: ProjectInfo;
  score: number;
  timestamp: string;
}

export const toJsonReport = (
  diagnostics: Diagnostic[],
  score: number,
  label: string,
  project: ProjectInfo
): JsonReport => ({
  diagnostics: diagnostics.map((d) => ({
    column: d.column,
    file: d.file,
    help: d.help,
    line: d.line,
    message: d.message,
    rule: d.rule,
    severity: d.severity,
  })),
  label,
  project,
  score,
  timestamp: new Date().toISOString(),
});
