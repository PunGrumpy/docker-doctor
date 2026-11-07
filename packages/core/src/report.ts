import { findRule } from "./rules/index";
import type {
  Diagnostic,
  ProjectInfo,
  RuleCategory,
  SuppressedDiagnostic,
} from "./types/index";

// Bump whenever the JSON report shape or the score formula/weights change.
export const REPORT_SCHEMA_VERSION = 7;

export interface ReportFailure {
  file: string;
  message: string;
}

export interface ReportDiagnostic {
  category: RuleCategory;
  file: string;
  help: string;
  line?: number;
  message: string;
  rule: string;
  severity: "error" | "warning" | "info";
}

// A finding that an inline ignore comment hid. It never counts toward the
// score or the exit code, and it lives in its own array so a consumer cannot
// count it by accident.
export interface ReportSuppressed extends ReportDiagnostic {
  reason: string | null;
}

export interface JsonReport {
  analyzedFiles: number;
  diagnostics: ReportDiagnostic[];
  failures: ReportFailure[];
  label: string | null;
  project: ProjectInfo;
  schemaVersion: number;
  score: number | null;
  suppressed: ReportSuppressed[];
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

const toReportDiagnostic = (d: Diagnostic): ReportDiagnostic => ({
  category: resolveCategory(d),
  file: d.file,
  help: d.help,
  line: d.line,
  message: d.message,
  rule: d.rule,
  severity: d.severity,
});

export const toJsonReport = (
  diagnostics: Diagnostic[],
  score: number | null,
  label: string | null,
  project: ProjectInfo,
  failures: ReportFailure[],
  analyzedFiles: number,
  suppressed: SuppressedDiagnostic[]
): JsonReport => ({
  analyzedFiles,
  diagnostics: diagnostics.map(toReportDiagnostic),
  failures: failures.map(({ file, message }) => ({ file, message })),
  label,
  project,
  schemaVersion: REPORT_SCHEMA_VERSION,
  score,
  suppressed: suppressed.map((d) => ({
    ...toReportDiagnostic(d),
    reason: d.reason,
  })),
  timestamp: new Date().toISOString(),
});
