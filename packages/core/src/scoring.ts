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

export type ScoreResult =
  | { label: string; score: number }
  | { label: null; score: null };

// `analyzedFileCount` is the number of files the rules could check, as
// decided by isAnalyzableDockerfile and isAnalyzableCompose. The penalty is
// averaged over them, so the score describes a typical file. A sum would
// instead grow with the number of Docker files. Under a sum, 96 files with
// two warnings each scored 0. With no analyzed file there is nothing to
// describe, so there is no score.
export const calculateScore = (
  diagnostics: Diagnostic[],
  analyzedFileCount: number
): ScoreResult => {
  if (!Number.isInteger(analyzedFileCount) || analyzedFileCount < 0) {
    throw new Error(
      `analyzedFileCount must be a whole number of files, got ${analyzedFileCount}`
    );
  }
  if (analyzedFileCount === 0) {
    if (diagnostics.length > 0) {
      throw new Error(
        `${diagnostics.length} diagnostics came from 0 analyzed files. Count the files the diagnostics came from.`
      );
    }
    return { label: null, score: null };
  }

  let totalPenalty = 0;

  for (const diag of diagnostics) {
    totalPenalty += SEVERITY_PENALTY[diag.severity];
  }

  const penalty = totalPenalty / analyzedFileCount;

  // Asymptotic decay curve: score = round(100 * e^(-penalty / K)), where
  // penalty is the average per analyzed file.
  //
  // The old `max(0, 100 - penalty)` formula saturates at 0 once penalty
  // reaches 100 (e.g. ~10 errors), so a messy project and a catastrophic
  // one are indistinguishable and the score can never register a fix.
  // The curve itself never reaches 0, so the score keeps moving across a
  // far wider range. Rounding still gives 0 once the average penalty passes
  // about 371 (70 * ln 200), which is roughly 37 errors in every file.
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
