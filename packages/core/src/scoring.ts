import type { Diagnostic } from "./types/index";

export const calculateScore = (
  diagnostics: Diagnostic[]
): {
  score: number;
  label: string;
} => {
  let penalty = 0;

  for (const diag of diagnostics) {
    if (diag.severity === "error") {
      penalty += 10;
    } else if (diag.severity === "warning") {
      penalty += 4;
    } else if (diag.severity === "info") {
      penalty += 1;
    }
  }

  const score = Math.max(0, 100 - penalty);

  let label = "Critical 🚨";
  if (score >= 90) {
    label = "Excellent 🏆";
  } else if (score >= 75) {
    label = "Good ✅";
  } else if (score >= 50) {
    label = "Needs Work ⚠️";
  }

  return { label, score };
};
