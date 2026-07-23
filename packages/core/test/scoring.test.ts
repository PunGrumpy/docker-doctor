import { describe, test, expect } from "bun:test";

import { calculateScore, getScoreBucket, SCORE_BUCKETS } from "../src/scoring";
import type { Diagnostic } from "../src/types/index";

const diag = (severity: "error" | "warning" | "info"): Diagnostic => ({
  file: "Dockerfile",
  help: "",
  message: "",
  rule: "docker-doctor/test",
  severity,
});

const many = (severity: "error" | "warning" | "info", n: number) =>
  Array.from({ length: n }, () => diag(severity));

describe("calculateScore (asymptotic curve, K=70)", () => {
  test("a perfect project scores 100", () => {
    expect(calculateScore([]).score).toBe(100);
  });

  test("one error scores 87", () => {
    expect(calculateScore(many("error", 1)).score).toBe(87);
  });

  test("one warning stays comfortably inside Excellent (~94)", () => {
    const { score, label } = calculateScore(many("warning", 1));
    expect(score).toBe(94);
    expect(label).toBe("Excellent 🏆");
  });

  test("one info scores 99", () => {
    expect(calculateScore(many("info", 1)).score).toBe(99);
  });

  test("is strictly monotonic and never saturates", () => {
    const a = calculateScore(many("error", 10)).score;
    const b = calculateScore(many("error", 20)).score;
    const c = calculateScore(many("error", 40)).score;
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(b);
  });

  test("score is always an integer in range", () => {
    for (const n of [0, 1, 5, 25, 100, 500]) {
      const { score } = calculateScore(many("warning", n));
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test("fixing an issue always raises the score", () => {
    const before = calculateScore(many("warning", 30)).score;
    const after = calculateScore(many("warning", 29)).score;
    expect(after).toBeGreaterThan(before);
  });

  test("label is Excellent at score exactly 90", () => {
    // penalty 7 -> round(100 * e^(-7/70)) = 90
    const { score, label } = calculateScore(many("info", 7));
    expect(score).toBe(90);
    expect(label).toBe("Excellent 🏆");
  });

  test("label is Good at score exactly 75", () => {
    // penalty 20 -> round(100 * e^(-20/70)) = 75
    const { score, label } = calculateScore(many("info", 20));
    expect(score).toBe(75);
    expect(label).toBe("Good ✅");
  });

  test("label is Needs Work at score exactly 50", () => {
    // penalty 48 -> round(100 * e^(-48/70)) = 50
    const { score, label } = calculateScore(many("info", 48));
    expect(score).toBe(50);
    expect(label).toBe("Needs Work ⚠️");
  });

  test("label is Critical at score exactly 49", () => {
    // penalty 50 -> round(100 * e^(-50/70)) = 49
    const { score, label } = calculateScore(many("info", 50));
    expect(score).toBe(49);
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
