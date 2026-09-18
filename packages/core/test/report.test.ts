import { describe, test, expect } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { REPORT_SCHEMA_VERSION, toJsonReport } from "../src/report";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";
import { calculateScore } from "../src/scoring";
import type { Diagnostic, ProjectInfo, RuleCategory } from "../src/types/index";

const EMPTY_PROJECT: ProjectInfo = { composeFiles: [], dockerfiles: [] };

const ALL_CATEGORIES: RuleCategory[] = [
  "Security",
  "Performance",
  "Best Practices",
  "Compose",
  "Image Size",
];

const TOP_LEVEL_KEYS = [
  "diagnostics",
  "label",
  "project",
  "schemaVersion",
  "score",
  "timestamp",
];

const DIAGNOSTIC_KEYS = [
  "category",
  "column",
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
  test("schemaVersion is 3", () => {
    expect(REPORT_SCHEMA_VERSION).toBe(3);
    expect(
      toJsonReport([], PERFECT_SCORE, "Excellent 🏆", EMPTY_PROJECT)
        .schemaVersion
    ).toBe(3);
  });

  test("top-level keys are exactly the documented set", () => {
    const report = toJsonReport(
      [],
      PERFECT_SCORE,
      "Excellent 🏆",
      EMPTY_PROJECT
    );
    expect(Object.keys(report).toSorted()).toEqual(TOP_LEVEL_KEYS);
  });

  test("every diagnostic carries exactly the documented keys", () => {
    const diagnostics = runDockerfileRules(
      parseDockerfile("FROM node\nCOPY . .\n"),
      "Dockerfile",
      []
    );
    const { score, label } = calculateScore(diagnostics);
    const report = toJsonReport(diagnostics, score, label, EMPTY_PROJECT);

    expect(report.diagnostics.length).toBeGreaterThan(0);
    for (const d of report.diagnostics) {
      // `column` is present with value undefined; JSON.stringify drops it on
      // the wire, so this asserts on the object, not the serialized form.
      expect(Object.keys(d).toSorted()).toEqual(DIAGNOSTIC_KEYS);
      expect(ALL_CATEGORIES).toContain(d.category);
    }
  });

  test("a hand-built diagnostic for a known rule resolves its category", () => {
    const report = toJsonReport(
      [diagnostic("docker-doctor/no-root-user", "warning")],
      0,
      "Critical 🚨",
      EMPTY_PROJECT
    );
    expect(report.diagnostics[0]?.category).toBe("Security");
  });

  test("a diagnostic for an unknown rule throws", () => {
    expect(() =>
      toJsonReport(
        [diagnostic("docker-doctor/does-not-exist", "warning")],
        0,
        "Critical 🚨",
        EMPTY_PROJECT
      )
    ).toThrow(/no category/u);
  });

  test("score constants are pinned", () => {
    expect(calculateScore([])).toEqual({
      label: "Excellent 🏆",
      score: PERFECT_SCORE,
    });
    expect(calculateScore([diagnostic("docker-doctor/test", "error")])).toEqual(
      {
        label: "Good ✅",
        score: ONE_ERROR_SCORE,
      }
    );
    expect(
      calculateScore([diagnostic("docker-doctor/test", "warning")])
    ).toEqual({ label: "Excellent 🏆", score: ONE_WARNING_SCORE });
    expect(calculateScore([diagnostic("docker-doctor/test", "info")])).toEqual({
      label: "Excellent 🏆",
      score: ONE_INFO_SCORE,
    });
  });
});
