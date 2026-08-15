import type { Metadata } from "next";

import { Hero } from "@/components/sections/leaderboard/hero";
import { Leaderboard } from "@/components/sections/leaderboard/leaderboard";
import { getLeaderboard } from "@/lib/leaderboard";

export const metadata: Metadata = {
  description:
    "Docker quality scores for popular open-source projects, scanned with the Docker Doctor CLI.",
  title: "Leaderboard",
};

const LeaderboardPage = async () => {
  const { doctorVersion, entries, generatedAt } = await getLeaderboard();

  return (
    <>
      <Hero
        doctorVersion={doctorVersion}
        generatedAt={generatedAt}
        repoCount={entries.length}
      />
      <Leaderboard entries={entries} />
    </>
  );
};

export default LeaderboardPage;
