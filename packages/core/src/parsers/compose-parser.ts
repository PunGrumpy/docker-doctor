import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  parse,
  parseDocument,
} from "yaml";

import { ParseError } from "../errors";
import type { ComposeLocator, ComposeValue } from "../types/index";
import { isComposeValue } from "./compose-value";

// yaml appends the offending source lines to its error message. Those lines
// can hold a secret, and the message reaches --json output and PR comments.
// Only the first line is kept. It still names the line and column.
const describeYamlError = (cause: unknown): string => {
  const text = cause instanceof Error ? cause.message : String(cause);
  const firstLine = text.split("\n", 1)[0] ?? "";
  return firstLine.endsWith(":") ? firstLine.slice(0, -1) : firstLine;
};

export const parseCompose = (
  content: string,
  filepath: string
): ComposeValue => {
  let document: unknown;

  try {
    // Compose files rely on YAML 1.1 merge keys (`<<: *anchor`); yaml's
    // default 1.2 schema leaves `<<` as a literal key without this option.
    document = parse(content, { merge: true });
  } catch (error: unknown) {
    throw new ParseError({ file: filepath, message: describeYamlError(error) });
  }

  // yaml builds only strings, numbers, booleans, null, arrays and objects,
  // so no YAML text reaches this error.
  if (!isComposeValue(document)) {
    throw new ParseError({
      file: filepath,
      message: "The YAML holds a value a Compose file cannot contain",
    });
  }

  return document;
};

/**
 * Builds a {@link ComposeLocator} over the same source text a compose object
 * was parsed from, so rules can attach line numbers to their diagnostics.
 *
 * Keys pulled in via YAML merge keys (`<<: *anchor`) have no concrete node
 * at the merge site, so paths through them resolve to `undefined` — callers
 * fall back to an unnumbered diagnostic, which matches the old behavior.
 */
const isSequenceIndex = (segment: string | number): segment is number =>
  typeof segment === "number";

export const createComposeLocator = (content: string): ComposeLocator => {
  const lineCounter = new LineCounter();
  const doc = parseDocument(content, { lineCounter, merge: true });

  return (path) => {
    let node: unknown = doc.contents;
    let offset: number | undefined;

    for (const segment of path) {
      if (isAlias(node)) {
        node = node.resolve(doc);
      }
      if (isMap(node)) {
        const pair = node.items.find(
          (item) =>
            isScalar(item.key) && String(item.key.value) === String(segment)
        );
        if (!pair || !isScalar(pair.key)) {
          return;
        }
        offset = pair.key.range?.[0];
        node = pair.value;
      } else if (isSeq(node) && isSequenceIndex(segment)) {
        const item = node.items[segment];
        if (item === undefined || item === null) {
          return;
        }
        offset = isNode(item) ? item.range?.[0] : undefined;
        node = item;
      } else {
        return;
      }
    }

    return offset === undefined ? undefined : lineCounter.linePos(offset).line;
  };
};
