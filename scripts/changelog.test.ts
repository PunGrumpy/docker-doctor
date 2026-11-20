import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { parseChangelogText } from "../apps/web/lib/changelog";

const CHANGELOG = path.join(
  import.meta.dir,
  "../packages/docker-doctor/CHANGELOG.md"
);

const header = "# @docker-doctor/cli\n\n## 1.2.3\n\n### Minor Changes\n\n";

const parseMinor = (body: string) =>
  parseChangelogText(`${header}${body}`).versions[0]?.minor ?? [];

describe("parseChangelogText", () => {
  test("keeps a paragraph that follows the title after a blank line", () => {
    const [change] = parseMinor(
      "- abc1234: Add a flag\n\n  For library users, `f` now takes an object.\n"
    );

    expect(change?.details).toEqual([
      {
        kind: "paragraph",
        text: "For library users, `f` now takes an object.",
      },
    ]);
  });

  test("keeps several paragraphs in order", () => {
    const [change] = parseMinor(
      "- abc1234: Add a flag\n\n  First paragraph.\n\n  Second paragraph.\n"
    );

    expect(change?.details).toEqual([
      { kind: "paragraph", text: "First paragraph." },
      { kind: "paragraph", text: "Second paragraph." },
    ]);
  });

  test("keeps indented bullets as bullets", () => {
    const [change] = parseMinor("- abc1234: Add a flag\n\n  - one\n  - two\n");

    expect(change?.details).toEqual([
      { kind: "bullet", text: "one" },
      { kind: "bullet", text: "two" },
    ]);
  });

  test("keeps a paragraph and the bullets under it in source order", () => {
    const [change] = parseMinor(
      "- abc1234: Add a flag\n\n  Intro.\n\n  - one\n\n  Outro.\n"
    );

    expect(change?.details.map((detail) => detail.kind)).toEqual([
      "paragraph",
      "bullet",
      "paragraph",
    ]);
  });

  test("does not leak a paragraph into the next change", () => {
    const [first, second] = parseMinor(
      "- abc1234: First\n\n  Only for the first.\n\n- def5678: Second\n"
    );

    expect(first?.details).toHaveLength(1);
    expect(second?.details).toEqual([]);
  });

  test("does not leak a paragraph across a version heading", () => {
    const data = parseChangelogText(
      `${header}- abc1234: First\n\n  Only for the first.\n\n## 1.2.2\n\n### Minor Changes\n\n- def5678: Second\n`
    );

    expect(data.versions[1]?.minor[0]?.details).toEqual([]);
  });

  test("drops indented text under a heading it does not collect", () => {
    const data = parseChangelogText(
      `${header}- abc1234: First\n\n### Major Changes\n\n  Not collected.\n`
    );

    expect(data.versions[0]?.minor[0]?.details).toEqual([]);
  });
});

const COLLECTED_HEADINGS = new Set(["### minor changes", "### patch changes"]);
const CHANGE_LINE = /^-\s+[a-f0-9]+:\s+\S/u;

// Counts indented text lines under a collected change without sharing code
// with the parser, so a new shape in the real file cannot be dropped silently.
const countIndentedLines = (text: string): number => {
  let collecting = false;
  let inChange = false;
  let count = 0;

  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      collecting = COLLECTED_HEADINGS.has(line.trim().toLowerCase());
      inChange = false;
    } else if (collecting && CHANGE_LINE.test(line)) {
      inChange = true;
    } else if (inChange && /^\s{2,}\S/u.test(line)) {
      count += 1;
    }
  }

  return count;
};

describe("parseChangelogText on the real changelog", () => {
  const text = fs.readFileSync(CHANGELOG, "utf-8");
  const { versions } = parseChangelogText(text);
  const changes = versions.flatMap((v) => [...v.minor, ...v.patch]);

  test("keeps every indented line as a detail", () => {
    const parsed = changes.reduce((sum, c) => sum + c.details.length, 0);

    expect(parsed).toBe(countIndentedLines(text));
  });

  test("keeps the library note of the 0.11.0 baseline change", () => {
    const baseline = versions
      .find((v) => v.version === "0.11.0")
      ?.minor.find((c) => c.sha === "b1c034f");

    expect(
      baseline?.details.some(
        (d) => d.kind === "paragraph" && d.text.startsWith("For library users")
      )
    ).toBe(true);
  });
});
