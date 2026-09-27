/**
 * The rule count is hand-typed on a few marketing pages: the READMEs, the
 * docs landing page, and the architecture diagram caption. This script fails
 * when one of them disagrees with the rules the CLI registers. Run it with:
 *
 *   bun run check:rule-count
 *
 * CI's Format job runs it. A new page that states the count belongs in
 * `SURFACES`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { allRules } from "../packages/core/src/rules/index";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUMMARY_SENTENCE = /runs (?<count>\d+) rules across/u;

interface Surface {
  file: string;
  /** The `count` named group captures the stated rule count. */
  pattern: RegExp;
}

const SURFACES: readonly Surface[] = [
  { file: "README.md", pattern: SUMMARY_SENTENCE },
  { file: "packages/docker-doctor/README.md", pattern: SUMMARY_SENTENCE },
  { file: "apps/web/content/docs/index.mdx", pattern: SUMMARY_SENTENCE },
  {
    file: "apps/web/content/docs/index.mdx",
    pattern: /title="(?<count>\d+) built-in rules"/u,
  },
  {
    file: "apps/web/components/architecture-diagram.tsx",
    pattern: /(?<count>\d+) rules across five categories/u,
  },
];

const expected = allRules.length;
const problems: string[] = [];

for (const { file, pattern } of SURFACES) {
  const text = readFileSync(path.join(ROOT, file), "utf-8");
  const stated = pattern.exec(text)?.groups?.count;
  if (stated === undefined) {
    problems.push(
      `${file}: no text matches ${pattern}; update the pattern or the page`
    );
  } else if (Number(stated) !== expected) {
    problems.push(
      `${file}: says ${stated} rules, but the CLI registers ${expected}`
    );
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(`${expected} rules, and every documented count matches.`);
