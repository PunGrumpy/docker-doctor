export interface ScoreData {
  background: string;
  border: string;
  color: string;
  label: string;
}

export const getScoreData = (score: number): ScoreData => {
  if (score >= 90) {
    return {
      background: "bg-green-500/10",
      border: "border-green-500",
      color: "#22c55e",
      label: "Excellent",
    };
  }
  if (score >= 75) {
    return {
      background: "bg-yellow-500/10",
      border: "border-yellow-500",
      color: "#eab308",
      label: "Good",
    };
  }
  return {
    background: "bg-red-500/10",
    border: "border-red-500",
    color: "#ef4444",
    label: "Needs Work",
  };
};

const clampScore = (n: number): number => Math.min(100, Math.max(0, n));

/**
 * Parses a raw `s` query-param value into a score clamped to [0, 100].
 *
 * `value === null` (the param is absent) falls back to `fallback`.
 * Any present-but-non-finite value (e.g. "abc") also falls back to
 * `fallback`. An empty string ("") is a *present* value: `Number("")`
 * is `0`, so it clamps to `0` rather than falling back -- this is a
 * deliberate choice, not an oversight.
 */
export const parseScoreQuery = (
  value: string | null,
  fallback = 100
): number => {
  if (value === null) {
    return clampScore(fallback);
  }
  const parsed = Number(value);
  const n = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return clampScore(n);
};
