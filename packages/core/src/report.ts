import { compareWithBaseline, isNewFinding } from "./baseline";
import type { BaselineCounts } from "./baseline";
import { findRule } from "./rules/index";
import type {
  Diagnostic,
  FingerprintedDiagnostic,
  ProjectInfo,
  RuleCategory,
  SuppressedDiagnostic,
} from "./types/index";

// Bump whenever the JSON report shape or the score formula/weights change.
export const REPORT_SCHEMA_VERSION = 8;

export interface ReportFailure {
  file: string;
  message: string;
}

export interface ReportDiagnostic {
  category: RuleCategory;
  file: string;
  // Stays the same across scans while the code the finding points at is
  // unchanged. See runners/fingerprint.ts.
  fingerprint: string;
  help: string;
  line?: number;
  message: string;
  // Present only on a scan run with --baseline: true when the saved report
  // does not have this finding.
  new?: boolean;
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
  // null unless the scan ran with --baseline.
  baseline: BaselineCounts | null;
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

const toReportDiagnostic = (d: FingerprintedDiagnostic): ReportDiagnostic => ({
  category: resolveCategory(d),
  file: d.file,
  fingerprint: d.fingerprint,
  help: d.help,
  line: d.line,
  message: d.message,
  rule: d.rule,
  severity: d.severity,
});

export interface ReportInput {
  analyzedFiles: number;
  // The fingerprints of the saved report's findings, or null without
  // --baseline.
  baseline: ReadonlySet<string> | null;
  diagnostics: readonly FingerprintedDiagnostic[];
  failures: readonly ReportFailure[];
  label: string | null;
  project: ProjectInfo;
  score: number | null;
  suppressed: readonly (FingerprintedDiagnostic & SuppressedDiagnostic)[];
}

export const toJsonReport = ({
  analyzedFiles,
  baseline,
  diagnostics,
  failures,
  label,
  project,
  score,
  suppressed,
}: ReportInput): JsonReport => ({
  analyzedFiles,
  baseline:
    baseline === null ? null : compareWithBaseline(diagnostics, baseline),
  diagnostics: diagnostics.map((d) =>
    baseline === null
      ? toReportDiagnostic(d)
      : { ...toReportDiagnostic(d), new: isNewFinding(d, baseline) }
  ),
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
