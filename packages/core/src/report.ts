import { findRule } from "./rules/index";
import type { Diagnostic, ProjectInfo, RuleCategory } from "./types/index";

// Bump whenever the JSON report shape or the score formula/weights change.
// The unversioned shape shipped before this field existed is implicitly 1.
// v3 (2026-09): added diagnostics[].category.
export const REPORT_SCHEMA_VERSION = 3;

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
  project: ProjectInfo
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
  label,
  project,
  schemaVersion: REPORT_SCHEMA_VERSION,
  score,
  timestamp: new Date().toISOString(),
});
