export interface ScoreData {
  background: string;
  border: string;
  color: string;
  label: string;
}

// NOTE: this mirrors `SCORE_BUCKETS` in `packages/core/src/scoring.ts`
// (thresholds 90/75/50/0). It is intentionally NOT imported from
// `@docker-doctor/core`: that package exposes one barrel, and the barrel
// re-exports `discoverProject` and `loadConfig`, which import
// `node:fs/promises`. `getScoreData` is called from client components
// (`components/sections/leaderboard/leaderboard.tsx`), so importing the
// barrel there fails the build with "the chunking context does not
// support external modules (request: node:fs/promises)". Server routes
// import core without trouble, which is why `app/schema.json/route.ts`
// can. Removing this copy needs a `./scoring` subpath export on core.
const SCORE_BUCKETS = [
  {
    background: "bg-green-500/10",
    border: "border-green-500",
    color: "#22c55e",
    label: "Excellent",
    min: 90,
  },
  {
    background: "bg-yellow-500/10",
    border: "border-yellow-500",
    color: "#eab308",
    label: "Good",
    min: 75,
  },
  {
    background: "bg-orange-500/10",
    border: "border-orange-500",
    color: "#f97316",
    label: "Needs Work",
    min: 50,
  },
  {
    background: "bg-red-600/10",
    border: "border-red-600",
    color: "#dc2626",
    label: "Critical",
    min: 0,
  },
] as const;

export const getScoreData = (score: number): ScoreData => {
  for (const bucket of SCORE_BUCKETS) {
    if (score >= bucket.min) {
      return bucket;
    }
  }
  return SCORE_BUCKETS.at(-1) as ScoreData;
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

/**
 * Parses a raw `w`/`e` query-param value into a non-negative integer
 * count, with the same null/non-finite fallback semantics as
 * `parseScoreQuery`.
 */
export const parseCountQuery = (value: string | null, fallback = 0): number => {
  if (value === null) {
    return Math.max(0, fallback);
  }
  const parsed = Number(value);
  const n = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.max(0, n);
};
