import { readFileSync } from "node:fs";

export interface Change {
  sha: string;
  title: string;
  details: string[];
}

export interface VersionEntry {
  version: string;
  minor: Change[];
  patch: Change[];
}

export interface ChangelogData {
  packageName: string;
  versions: VersionEntry[];
}

export const parseChangelog = (filePath: string): ChangelogData => {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.split("\n");

  let packageName = "";
  const versions: VersionEntry[] = [];
  let currentVersion: VersionEntry | null = null;
  let currentSection: "minor" | "patch" | null = null;
  let currentChange: Change | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      packageName = line.slice(2).trim();
    } else if (line.startsWith("## ")) {
      if (currentVersion) {
        versions.push(currentVersion);
      }
      currentVersion = {
        minor: [],
        patch: [],
        version: line.slice(3).trim(),
      };
      currentSection = null;
      currentChange = null;
    } else if (line.startsWith("### ")) {
      const section = line.slice(4).trim().toLowerCase();
      if (section === "minor changes") {
        currentSection = "minor";
      } else if (section === "patch changes") {
        currentSection = "patch";
      } else {
        currentSection = null;
      }
      currentChange = null;
    } else if (line.startsWith("- ") && currentSection && currentVersion) {
      // oxlint-disable-next-line prefer-named-capture-group
      const shaMatch = line.match(/^-\s+([a-f0-9]+):\s+(.+)/u);
      if (shaMatch) {
        currentChange = {
          details: [],
          sha: shaMatch[1],
          title: shaMatch[2],
        };
        currentVersion[currentSection].push(currentChange);
      } else if (currentChange) {
        currentChange.details.push(line.replace(/^-\s+/u, "").trim());
      }
    } else if (line.startsWith("  - ") && currentChange) {
      currentChange.details.push(line.replace(/^\s+-\s+/u, "").trim());
    }
  }

  if (currentVersion) {
    versions.push(currentVersion);
  }

  return { packageName, versions };
};
