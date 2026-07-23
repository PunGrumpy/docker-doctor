import type { Diagnostic } from "./types/index";

export const SCORE_BUCKETS = [
  { emoji: "🏆", label: "Excellent", min: 90 },
  { emoji: "✅", label: "Good", min: 75 },
  { emoji: "⚠️", label: "Needs Work", min: 50 },
  { emoji: "🚨", label: "Critical", min: 0 },
] as const;

export const getScoreBucket = (
  score: number
): (typeof SCORE_BUCKETS)[number] => {
  for (const bucket of SCORE_BUCKETS) {
    if (score >= bucket.min) {
      return bucket;
    }
  }
  return SCORE_BUCKETS.at(-1) as (typeof SCORE_BUCKETS)[number];
};

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
  const bucket = getScoreBucket(score);
  const label = `${bucket.label} ${bucket.emoji}`;

  return { label, score };
};
