import fs from "node:fs/promises";
import path from "node:path";

import type { Diagnostic, JsonReport } from "@docker-doctor/core";

export const DIAGNOSTICS_DIR_NAME = ".docker-doctor";

const UNSAFE_FILE_CHARS = /[^a-z0-9-]+/giu;

const ruleFileName = (rule: string): string => {
  const shortKey = rule.split("/").at(-1) ?? rule;
  return `${shortKey.replace(UNSAFE_FILE_CHARS, "-")}.txt`;
};

export const groupDiagnosticsByRule = (
  diagnostics: Diagnostic[]
): Map<string, Diagnostic[]> => {
  const groups = new Map<string, Diagnostic[]>();
  for (const diagnostic of diagnostics) {
    const group = groups.get(diagnostic.rule);
    if (group) {
      group.push(diagnostic);
    } else {
      groups.set(diagnostic.rule, [diagnostic]);
    }
  }
  return groups;
};

// Writes the full scan results into <root>/.docker-doctor/ — diagnostics.json
// (the same shape as `--json`) plus one .txt per rule — so the handed-off
// agent can read past the inline prompt. Recreated fresh on every handoff.
export const writeDiagnosticsDirectory = async (
  diagnostics: Diagnostic[],
  report: JsonReport,
  rootDir: string
): Promise<string> => {
  const dir = path.join(rootDir, DIAGNOSTICS_DIR_NAME);
  await fs.rm(dir, { force: true, recursive: true });
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    path.join(dir, "diagnostics.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  const writes: Promise<void>[] = [];
  for (const [rule, ruleDiagnostics] of groupDiagnosticsByRule(diagnostics)) {
    const [first] = ruleDiagnostics;
    const lines = [
      `${rule} (${first.severity})`,
      first.message,
      `Fix: ${first.help}`,
      "",
      ...ruleDiagnostics.map(
        (d) => `${d.file}${d.line === undefined ? "" : `:${d.line}`}`
      ),
      "",
    ];
    writes.push(
      fs.writeFile(
        path.join(dir, ruleFileName(rule)),
        lines.join("\n"),
        "utf-8"
      )
    );
  }
  await Promise.all(writes);

  return dir;
};

// Keeps the scan output out of version control: appends `.docker-doctor/` to
// the project's .gitignore when it isn't covered yet. Only creates a new
// .gitignore when the project is actually a git repository.
export const ensureGitignoreEntry = async (rootDir: string): Promise<void> => {
  const gitignorePath = path.join(rootDir, ".gitignore");

  let existing: string | null = null;
  try {
    existing = await fs.readFile(gitignorePath, "utf-8");
  } catch {
    existing = null;
  }

  if (existing !== null) {
    const isIgnored = existing
      .split(/\r?\n/u)
      .some((line) =>
        [
          DIAGNOSTICS_DIR_NAME,
          `${DIAGNOSTICS_DIR_NAME}/`,
          `/${DIAGNOSTICS_DIR_NAME}`,
          `/${DIAGNOSTICS_DIR_NAME}/`,
        ].includes(line.trim())
      );
    if (isIgnored) {
      return;
    }
    const separator = existing.endsWith("\n") || existing === "" ? "" : "\n";
    await fs.writeFile(
      gitignorePath,
      `${existing}${separator}${DIAGNOSTICS_DIR_NAME}/\n`,
      "utf-8"
    );
    return;
  }

  try {
    await fs.access(path.join(rootDir, ".git"));
  } catch {
    return;
  }
  await fs.writeFile(gitignorePath, `${DIAGNOSTICS_DIR_NAME}/\n`, "utf-8");
};
