import { createHash } from "node:crypto";

import type { ParsedNode } from "yaml";
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
} from "yaml";

import { parseDockerfile } from "../parsers/dockerfile-parser";
import { allComposeRules, findRule } from "../rules/index";
import { looksSecret, redactSecrets } from "../rules/redact-secrets";
import type { Diagnostic, FingerprintedDiagnostic } from "../types/index";

// 64 bits. A collision needs billions of findings in one project.
const FINGERPRINT_LENGTH = 16;
const SEPARATOR = "\u0000";
const WHITESPACE_RUN = /\s+/gu;
const LINE_BREAK = /\r?\n/u;
const REDACTED = "***";

const COMPOSE_RULE_KEYS = new Set(allComposeRules.map((rule) => rule.key));

// What a finding points at, in words that survive an edit elsewhere in the
// file. The line number and the message do not: messages quote line numbers.
type SubjectAt = (line: number) => string;

const collapse = (text: string): string =>
  text.replaceAll(WHITESPACE_RUN, " ").trim();

// A YAML node as text, keys sorted and the value under any secret-named key
// masked, so comments, key order and a rotated secret leave it unchanged.
// redactSecrets cannot mask the joined text, because its mapping pattern
// needs each key at the start of a line.
const canonicalText = (node: ParsedNode | null): string => {
  if (isMap(node)) {
    const entries = node.items.map((pair) => {
      const key = isScalar(pair.key) ? String(pair.key.value) : "";
      const value = looksSecret(key) ? REDACTED : canonicalText(pair.value);

      return `${JSON.stringify(key)}:${value}`;
    });

    return `{${entries.toSorted().join(",")}}`;
  }

  if (isSeq(node)) {
    return `[${node.items.map(canonicalText).join(",")}]`;
  }

  if (isScalar(node)) {
    return JSON.stringify(node.value) ?? "null";
  }

  return isAlias(node) ? `*${node.source}` : "null";
};

const itemName = (item: ParsedNode): string =>
  isScalar(item) ? String(item.value) : canonicalText(item);

// The instruction that starts on the line, continuations joined. A finding
// on any other line, such as the `# syntax=` directive, is named by the text
// of that line.
const dockerfileSubjects = (content: string): SubjectAt => {
  const instructions = new Map(
    parseDockerfile(content).map((inst) => [
      inst.line,
      `${inst.instruction} ${inst.args}`,
    ])
  );

  const lines = content.split(LINE_BREAK);

  return (line) => collapse(instructions.get(line) ?? lines[line - 1] ?? "");
};

// The outermost key or list item that starts on the line, as a path from the
// document root. A list item is named by its parsed value, not its position
// or source text, so an item inserted above it, a comment inside it or a
// reordered key leaves its name alone.
const composeSubjects = (content: string): SubjectAt => {
  const lineCounter = new LineCounter();
  const doc = parseDocument(content, { lineCounter, merge: true });
  const paths = new Map<number, string>();

  const record = (node: ParsedNode, path: string[]): void => {
    const { line } = lineCounter.linePos(node.range[0]);

    if (!paths.has(line)) {
      paths.set(line, path.join(SEPARATOR));
    }
  };

  const walk = (node: ParsedNode | null, path: string[]): void => {
    if (isMap(node)) {
      for (const pair of node.items) {
        const keyPath = [
          ...path,
          isScalar(pair.key) ? String(pair.key.value) : "",
        ];

        record(pair.key, keyPath);
        walk(pair.value, keyPath);
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        const itemPath = [...path, itemName(item)];

        record(item, itemPath);
        walk(item, itemPath);
      }
    }
  };

  walk(doc.contents, []);

  return (line) => paths.get(line) ?? "";
};

const hash = (key: string, occurrence: number): string =>
  createHash("sha256")
    .update(`${key}${SEPARATOR}${occurrence}`)
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);

/**
 * Gives each finding a key that stays the same across scans while the code it
 * points at is unchanged: a hash of the rule, the file, the subject (the
 * Dockerfile instruction or Compose key path at the finding's line) and an
 * occurrence index among findings that share all three. Rules marked
 * `anchor: "file"` have an empty subject. A Compose list item that is a
 * mapping is named by its parsed value with secret-named values masked, and
 * every subject passes through redactSecrets, so a rotated secret leaves the
 * fingerprint alone.
 */
export const fingerprintDiagnostics = (
  diagnostics: readonly Diagnostic[],
  fileContents: Readonly<Record<string, string>>
): FingerprintedDiagnostic[] => {
  const subjectsByFile = new Map<string, SubjectAt>();

  const subjectOf = (diagnostic: Diagnostic): string => {
    const content = fileContents[diagnostic.file];

    if (
      diagnostic.line === undefined ||
      content === undefined ||
      findRule(diagnostic.rule)?.anchor === "file"
    ) {
      return "";
    }

    let subjects = subjectsByFile.get(diagnostic.file);

    if (subjects === undefined) {
      subjects = COMPOSE_RULE_KEYS.has(diagnostic.rule)
        ? composeSubjects(content)
        : dockerfileSubjects(content);
      subjectsByFile.set(diagnostic.file, subjects);
    }

    return redactSecrets(subjects(diagnostic.line));
  };

  const entries = diagnostics.map((diagnostic) => ({
    diagnostic,
    fingerprint: "",
    key: [diagnostic.rule, diagnostic.file, subjectOf(diagnostic)].join(
      SEPARATOR
    ),
  }));

  // Occurrences count in line order, not in the order the rules ran.
  const byLine = entries.toSorted(
    (a, b) => (a.diagnostic.line ?? 0) - (b.diagnostic.line ?? 0)
  );

  const seen = new Map<string, number>();

  for (const entry of byLine) {
    const occurrence = seen.get(entry.key) ?? 0;

    seen.set(entry.key, occurrence + 1);
    entry.fingerprint = hash(entry.key, occurrence);
  }

  return entries.map(({ diagnostic, fingerprint }) => ({
    ...diagnostic,
    fingerprint,
  }));
};
