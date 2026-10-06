import { findRule } from "./rules/index";
import type { Diagnostic, ProjectInfo, RuleCategory } from "./types/index";

// Bump whenever the JSON report shape or the score formula/weights change.
// The unversioned shape shipped before this field existed is implicitly 1.
// v3 (2026-09): added diagnostics[].category.
// v4 (2026-09): added failures[], the files discovered but not analyzed
// (read or parse errors).
// v5 (2026-10): the score averages the penalty over the analyzed files.
export const REPORT_SCHEMA_VERSION = 5;

export interface ReportFailure {
  file: string;
  message: string;
}

export interface JsonReport {
  diagnostics: {
    category: RuleCategory;
    column?: number;
    file: string;
    help: string;
    line?: number;
    message: string;
    rule: string;
    severity: "error" | "warning" | "info";
  }[];
  failures: ReportFailure[];
  label: string;
  project: ProjectInfo;
  schemaVersion: number;
  score: number;
  timestamp: string;
}

// Diagnostics reach the report through a runner, which stamps category.
// The findRule fallback covers callers that build diagnostics by hand.
const resolveCategory = (diagnostic: Diagnostic): RuleCategory => {
  const category = diagnostic.category ?? findRule(diagnostic.rule)?.category;
  if (!category) {
    throw new Error(
      `Diagnostic for unknown rule "${diagnostic.rule}" has no category`
    );
  }
  return category;
};

export const toJsonReport = (
  diagnostics: Diagnostic[],
  score: number,
  label: string,
  project: ProjectInfo,
  failures: ReportFailure[] = []
): JsonReport => ({
  diagnostics: diagnostics.map((d) => ({
    category: resolveCategory(d),
    column: d.column,
    file: d.file,
    help: d.help,
    line: d.line,
    message: d.message,
    rule: d.rule,
    severity: d.severity,
  })),
  failures: failures.map(({ file, message }) => ({ file, message })),
  label,
  project,
  schemaVersion: REPORT_SCHEMA_VERSION,
  score,
  timestamp: new Date().toISOString(),
});
