import path from "node:path";

import type { Metadata } from "next";

import { Changelog } from "@/components/sections/changelog/changelog";
import { Hero } from "@/components/sections/changelog/hero";
import { parseChangelog } from "@/lib/changelog";

export const metadata: Metadata = {
  description: "Release notes for the Docker Doctor CLI.",
  title: "Changelog",
};

const ChangelogPage = () => {
  const changelogPath = path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "docker-doctor",
    "CHANGELOG.md"
  );
  const changelog = parseChangelog(changelogPath);

  return (
    <>
      <Hero />
      <Changelog data={changelog} />
    </>
  );
};

export default ChangelogPage;
