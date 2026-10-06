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

const SEVERITY_PENALTY = { error: 10, info: 1, warning: 4 } as const;

// `analyzedFileCount` is the number of Dockerfiles and Compose files the
// diagnostics came from. The penalty is averaged over them, so the score
// describes a typical file. A sum would instead measure how many Docker
// files a repository has: 96 files with two warnings each scored 0.
export const calculateScore = (
  diagnostics: Diagnostic[],
  analyzedFileCount = 1
): {
  score: number;
  label: string;
} => {
  let totalPenalty = 0;

  for (const diag of diagnostics) {
    totalPenalty += SEVERITY_PENALTY[diag.severity];
  }

  const penalty = totalPenalty / Math.max(1, analyzedFileCount);

  // Asymptotic decay curve: score = round(100 * e^(-penalty / K)), where
  // penalty is the average per analyzed file.
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
