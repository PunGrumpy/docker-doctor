import type { Diagnostic, ProjectInfo } from "./types/index";

// Bump whenever the JSON report shape or the score formula/weights change.
// The unversioned shape shipped before this field existed is implicitly 1.
export const REPORT_SCHEMA_VERSION = 2;

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
  schemaVersion: number;
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
  schemaVersion: REPORT_SCHEMA_VERSION,
  score,
  timestamp: new Date().toISOString(),
});
