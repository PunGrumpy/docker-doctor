import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parse,
  parseDocument,
} from "yaml";

import { ParseError } from "../errors";
import type { ComposeLocator } from "../types/index";

export const parseCompose = (content: string, filepath: string): unknown => {
  try {
    // Compose files rely on YAML 1.1 merge keys (`<<: *anchor`); yaml's
    // default 1.2 schema leaves `<<` as a literal key without this option.
    return parse(content, { merge: true });
  } catch (error: unknown) {
    throw new ParseError({
      file: filepath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Builds a {@link ComposeLocator} over the same source text a compose object
 * was parsed from, so rules can attach line numbers to their diagnostics.
 *
 * Keys pulled in via YAML merge keys (`<<: *anchor`) have no concrete node
 * at the merge site, so paths through them resolve to `undefined` — callers
 * fall back to an unnumbered diagnostic, which matches the old behavior.
 */
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
      } else if (isSeq(node) && typeof segment === "number") {
        const item = node.items[segment];
        if (item === undefined || item === null) {
          return;
        }
        offset = (item as { range?: [number, number, number] | null })
          .range?.[0];
        node = item;
      } else {
        return;
      }
    }

    return offset === undefined ? undefined : lineCounter.linePos(offset).line;
  };
};
