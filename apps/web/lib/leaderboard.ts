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

export const getLeaderboard = async (): Promise<LeaderboardData> => {
  const res = await fetch(RESULTS_URL, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch leaderboard results: ${res.status}`);
  }
  const data = (await res.json()) as LeaderboardData;
  if (data.schemaVersion !== RESULTS_SCHEMA_VERSION) {
    throw new Error(
      `Leaderboard results schemaVersion ${data.schemaVersion} does not match expected ${RESULTS_SCHEMA_VERSION}`
    );
  }
  return data;
};
