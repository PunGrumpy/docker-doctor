import { describe, expect, test } from "bun:test";

import { calculateScore, getScoreBucket, SCORE_BUCKETS } from "../src/scoring";
import type { Diagnostic } from "../src/types/index";

const errorDiag = (n: number): Diagnostic[] =>
  Array.from({ length: n }, () => ({
    file: "Dockerfile",
    help: "help",
    message: "message",
    rule: "docker-doctor/test-rule",
    severity: "error" as const,
  }));

describe("calculateScore", () => {
  test("no diagnostics scores 100 and labels Excellent", () => {
    const { score, label } = calculateScore([]);
    expect(score).toBe(100);
    expect(label).toBe("Excellent 🏆");
  });

  test("scores >= 75 label Good", () => {
    // penalty 20 -> 80
    const { score, label } = calculateScore(errorDiag(2));
    expect(score).toBe(80);
    expect(label).toBe("Good ✅");
  });

  test("scores >= 50 label Needs Work", () => {
    // penalty 50 -> 50
    const { score, label } = calculateScore(errorDiag(5));
    expect(score).toBe(50);
    expect(label).toBe("Needs Work ⚠️");
  });

  test("scores below 50 label Critical", () => {
    // penalty 100 -> 0
    const { score, label } = calculateScore(errorDiag(10));
    expect(score).toBeLessThan(50);
    expect(label).toBe("Critical 🚨");
  });
});

describe("getScoreBucket", () => {
  test("returns the matching bucket for a boundary score", () => {
    expect(getScoreBucket(0).label).toBe("Critical");
    expect(getScoreBucket(49).label).toBe("Critical");
    expect(getScoreBucket(50).label).toBe("Needs Work");
    expect(getScoreBucket(75).label).toBe("Good");
    expect(getScoreBucket(90).label).toBe("Excellent");
    expect(getScoreBucket(100).label).toBe("Excellent");
  });

  test("SCORE_BUCKETS is ordered from highest to lowest threshold", () => {
    const mins = SCORE_BUCKETS.map((b) => b.min);
    expect(mins).toEqual([...mins].toSorted((a, b) => b - a));
  });
});
