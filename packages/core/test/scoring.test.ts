import { describe, test, expect } from "bun:test";

import { calculateScore } from "../src/scoring";
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

describe("calculateScore (characterization: current saturating curve)", () => {
  test("an empty diagnostics list scores 100", () => {
    expect(calculateScore([]).score).toBe(100);
  });

  test("one error scores 90", () => {
    expect(calculateScore(many("error", 1)).score).toBe(90);
  });

  test("one warning scores 96", () => {
    expect(calculateScore(many("warning", 1)).score).toBe(96);
  });

  test("one info scores 99", () => {
    expect(calculateScore(many("info", 1)).score).toBe(99);
  });

  test("ten errors scores 0", () => {
    expect(calculateScore(many("error", 10)).score).toBe(0);
  });

  test("twenty errors also scores 0 (saturation)", () => {
    expect(calculateScore(many("error", 20)).score).toBe(0);
  });

  test("label is Excellent at score exactly 90", () => {
    const { score, label } = calculateScore(many("info", 10));
    expect(score).toBe(90);
    expect(label).toBe("Excellent 🏆");
  });

  test("label is Good at score exactly 75", () => {
    const { score, label } = calculateScore(many("info", 25));
    expect(score).toBe(75);
    expect(label).toBe("Good ✅");
  });

  test("label is Needs Work at score exactly 50", () => {
    const { score, label } = calculateScore(many("info", 50));
    expect(score).toBe(50);
    expect(label).toBe("Needs Work ⚠️");
  });

  test("label is Critical at score exactly 49", () => {
    const { score, label } = calculateScore(many("info", 51));
    expect(score).toBe(49);
    expect(label).toBe("Critical 🚨");
  });
});
