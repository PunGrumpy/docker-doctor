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

  // Asymptotic decay curve: score = round(100 * e^(-penalty / K)).
  //
  // The old `max(0, 100 - penalty)` formula saturates at 0 once penalty
  // reaches 100 (e.g. ~10 errors), so a messy project and a catastrophic
  // one are indistinguishable and the score can never register a fix.
  // This curve approaches (but never reaches) 0, so it stays monotonic
  // and responsive across the whole range instead of going inert.
  //
  // K=70 was chosen so a single warning (penalty 4) still scores ~94,
  // comfortably inside the "Excellent" (>=90) bucket, while errors and
  // repeated warnings still meaningfully erode the score. K=40 (the
  // naive "half-life at penalty ~28" choice) was tried first and pushed
  // a single warning down to ~90 - right on the Excellent/Good boundary,
  // which is too harsh a penalty for one warning.
  const K = 70;
  const score = Math.round(100 * Math.exp(-penalty / K));
  const bucket = getScoreBucket(score);
  const label = `${bucket.label} ${bucket.emoji}`;

  return { label, score };
};
