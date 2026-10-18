const RESULTS_URL =
  "https://raw.githubusercontent.com/PunGrumpy/docker-doctor-benchmarks/main/results/leaderboard.json";

// Contract with PunGrumpy/docker-doctor-benchmarks (scripts/scan.ts). Bump
// both sides together — on mismatch the page fails loudly instead of
// rendering a half-broken table.
const RESULTS_SCHEMA_VERSION = 1;

const REVALIDATE_SECONDS = 86_400;

export interface LeaderboardEntry {
  commitSha: string;
  composeFileCount: number;
  dockerfileCount: number;
  errorCount: number;
  githubUrl: string;
  infoCount: number;
  name: string;
  score: number;
  scoreLabel: string;
  slug: string;
  warningCount: number;
}

export interface LeaderboardData {
  doctorVersion: string;
  entries: LeaderboardEntry[];
  generatedAt: string;
  schemaVersion: number;
}

interface ResultsBody {
  doctorVersion?: unknown;
  entries?: unknown;
  generatedAt?: unknown;
  schemaVersion?: unknown;
}

// Any JSON object can be read field by field. The fields are checked below.
const isResultsBody = (value: unknown): value is ResultsBody =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

// The entries themselves are not checked, as before.
const isLeaderboardData = (body: ResultsBody): body is LeaderboardData =>
  body.schemaVersion === RESULTS_SCHEMA_VERSION &&
  Array.isArray(body.entries) &&
  isString(body.doctorVersion) &&
  isString(body.generatedAt);

export const getLeaderboard = async (): Promise<LeaderboardData> => {
  const res = await fetch(RESULTS_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch leaderboard results: ${res.status}`);
  }
  const body: unknown = await res.json();
  const schemaVersion = isResultsBody(body) ? body.schemaVersion : undefined;
  if (schemaVersion !== RESULTS_SCHEMA_VERSION) {
    throw new Error(
      `Leaderboard results schemaVersion ${String(schemaVersion)} does not match expected ${RESULTS_SCHEMA_VERSION}`
    );
  }
  if (!(isResultsBody(body) && isLeaderboardData(body))) {
    throw new Error(
      "Leaderboard results lack doctorVersion, entries or generatedAt"
    );
  }
  return body;
};
