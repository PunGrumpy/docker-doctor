import { describe, test, expect } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { REPORT_SCHEMA_VERSION, toJsonReport } from "../src/report";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";
import { calculateScore } from "../src/scoring";
import type {
  Diagnostic,
  ProjectInfo,
  RuleCategory,
  SuppressedDiagnostic,
} from "../src/types/index";

const EMPTY_PROJECT: ProjectInfo = { composeFiles: [], dockerfiles: [] };

const ALL_CATEGORIES: RuleCategory[] = [
  "Security",
  "Performance",
  "Best Practices",
  "Compose",
  "Image Size",
];

const TOP_LEVEL_KEYS = [
  "analyzedFiles",
  "diagnostics",
  "failures",
  "label",
  "project",
  "schemaVersion",
  "score",
  "suppressed",
  "timestamp",
];

const DIAGNOSTIC_KEYS = [
  "category",
  "file",
  "help",
  "line",
  "message",
  "rule",
  "severity",
];

const PERFECT_SCORE = 100;
const ONE_ERROR_SCORE = 87;
const ONE_WARNING_SCORE = 94;
const ONE_INFO_SCORE = 99;

const SUPPRESSED_KEYS = [...DIAGNOSTIC_KEYS, "reason"].toSorted();

const buildReport = (
  diagnostics: Diagnostic[],
  score: number | null,
  label: string | null,
  project: ProjectInfo,
  failures: { file: string; message: string }[],
  analyzedFiles: number,
  suppressed: SuppressedDiagnostic[] = []
) =>
  toJsonReport(
    diagnostics,
    score,
    label,
    project,
    failures,
    analyzedFiles,
    suppressed
  );

const diagnostic = (
  rule: string,
  severity: Diagnostic["severity"]
): Diagnostic => ({
  file: "Dockerfile",
  help: "",
  message: "",
  rule,
  severity,
});

// This suite is the JSON report contract. Bumping REPORT_SCHEMA_VERSION is the
// ONLY way to change the assertions below: if you edit the report shape or the
// score formula/weights, bump the version and update this file in the same
// commit, because external consumers (the GitHub Action renderer, the
// benchmarks scanner, the improve-docker skill) key off that number.
describe("JSON report contract", () => {
  test("schemaVersion is 7", () => {
    expect(REPORT_SCHEMA_VERSION).toBe(7);
    expect(
      buildReport([], PERFECT_SCORE, "Excellent 🏆", EMPTY_PROJECT, [], 1)
        .schemaVersion
    ).toBe(7);
  });

  test("top-level keys are exactly the documented set", () => {
    const report = buildReport(
      [],
      PERFECT_SCORE,
      "Excellent 🏆",
      EMPTY_PROJECT,
      [],
      1
    );

    expect(Object.keys(report).toSorted()).toEqual(TOP_LEVEL_KEYS);
  });

  test("carries failures and the analyzed file count", () => {
    const failures = [{ file: "Dockerfile", message: "boom" }];

    const report = buildReport(
      [],
      PERFECT_SCORE,
      "Excellent 🏆",
      EMPTY_PROJECT,
      failures,
      3
    );

    expect(report.failures).toEqual(failures);
    expect(report.analyzedFiles).toBe(3);
  });

  test("no analyzed file gives a null score and label", () => {
    const failures = [{ file: "Dockerfile", message: "boom" }];
    const { score, label } = calculateScore([], 0);
    const report = buildReport([], score, label, EMPTY_PROJECT, failures, 0);
    expect(report.score).toBeNull();
    expect(report.label).toBeNull();
    expect(report.analyzedFiles).toBe(0);
  });

  test("every diagnostic carries exactly the documented keys", () => {
    const diagnostics = runDockerfileRules(
      parseDockerfile("FROM node\nCOPY . .\n"),
      "Dockerfile",
      []
    );

    const { score, label } = calculateScore(diagnostics, 1);

    const report = buildReport(diagnostics, score, label, EMPTY_PROJECT, [], 1);

    expect(report.diagnostics.length).toBeGreaterThan(0);

    for (const d of report.diagnostics) {
      // `line` is present with value undefined when a finding has no line;
      // JSON.stringify drops it on the wire, so this asserts on the object,
      // not the serialized form.
      expect(Object.keys(d).toSorted()).toEqual(DIAGNOSTIC_KEYS);
      expect(ALL_CATEGORIES).toContain(d.category);
    }
  });

  test("a report with no ignored findings has an empty suppressed list", () => {
    const report = buildReport(
      [],
      PERFECT_SCORE,
      "Excellent 🏆",
      EMPTY_PROJECT,
      [],
      1
    );

    expect(report.suppressed).toEqual([]);
  });

  test("every suppressed finding carries the diagnostic keys and a reason", () => {
    const suppressed: SuppressedDiagnostic[] = [
      {
        ...diagnostic("docker-doctor/no-root-user", "warning"),
        line: 1,
        reason: "set by the platform",
      },
      { ...diagnostic("docker-doctor/no-root-user", "warning"), reason: null },
    ];

    const report = buildReport(
      [],
      PERFECT_SCORE,
      "Excellent 🏆",
      EMPTY_PROJECT,
      [],
      1,
      suppressed
    );

    expect(report.suppressed).toHaveLength(2);

    for (const entry of report.suppressed) {
      expect(Object.keys(entry).toSorted()).toEqual(SUPPRESSED_KEYS);
      expect(ALL_CATEGORIES).toContain(entry.category);
    }

    expect(report.suppressed.map(({ reason }) => reason)).toEqual([
      "set by the platform",
      null,
    ]);
    expect(report.diagnostics).toEqual([]);
  });

  test("a suppressed finding for an unknown rule throws", () => {
    expect(() =>
      buildReport([], 0, "Critical 🚨", EMPTY_PROJECT, [], 1, [
        {
          ...diagnostic("docker-doctor/does-not-exist", "warning"),
          reason: null,
        },
      ])
    ).toThrow(/no category/u);
  });

  test("a hand-built diagnostic for a known rule resolves its category", () => {
    const report = buildReport(
      [diagnostic("docker-doctor/no-root-user", "warning")],
      0,
      "Critical 🚨",
      EMPTY_PROJECT,
      [],
      1
    );

    expect(report.diagnostics[0]?.category).toBe("Security");
  });

  test("a diagnostic for an unknown rule throws", () => {
    expect(() =>
      buildReport(
        [diagnostic("docker-doctor/does-not-exist", "warning")],
        0,
        "Critical 🚨",
        EMPTY_PROJECT,
        [],
        1
      )
    ).toThrow(/no category/u);
  });

  test("score constants are pinned", () => {
    expect(calculateScore([], 1)).toEqual({
      label: "Excellent 🏆",
      score: PERFECT_SCORE,
    });
    expect(
      calculateScore([diagnostic("docker-doctor/test", "error")], 1)
    ).toEqual({
      label: "Good ✅",
      score: ONE_ERROR_SCORE,
    });
    expect(
      calculateScore([diagnostic("docker-doctor/test", "warning")], 1)
    ).toEqual({ label: "Excellent 🏆", score: ONE_WARNING_SCORE });
    expect(
      calculateScore([diagnostic("docker-doctor/test", "info")], 1)
    ).toEqual({
      label: "Excellent 🏆",
      score: ONE_INFO_SCORE,
    });
  });
});
