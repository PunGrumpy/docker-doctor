import type { Document, Node, Pair, YAMLMap, YAMLSeq } from "yaml";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
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

// Compose's merge tags (compose-go `loader/reset.go:111-118`). `!reset`
// drops the value from its own file, and both tags delete the value earlier
// files set at that path before this file merges over them. A tagged scalar
// keeps its source text, as go-yaml decodes a scalar with an unknown tag. An
// empty one is null.
const RESET_TAG = "!reset";
const OVERRIDE_TAG = "!override";

const COMPOSE_TAGS = [
  { resolve: (): null => null, tag: RESET_TAG },
  {
    resolve: (source: string): string | null => (source === "" ? null : source),
    tag: OVERRIDE_TAG,
  },
];

// compose-go refuses a document past 100,000 node visits
// (`loader/reset.go:32` and `:96-103`), and each tagged value is one. An
// alias repeats the tagged values below its anchor, so each repeat counts
// again, and a tower of aliases is refused before it expands.
const MAX_TAGGED_VALUES = 100_000;

export type ComposePath = readonly string[];

/**
 * A Compose file as compose-go reads it. `document` has every `!reset` value
 * removed and every `!override` value kept. `replacedPaths` lists the
 * mapping-key paths that carried either tag. Compose deletes the value an
 * earlier file set at each of them before merging this file over it.
 */
export interface ComposeFile {
  document: ComposeValue;
  replacedPaths: readonly ComposePath[];
}

interface TagScan {
  doc: Document;
  // Relative paths found below each container, kept so an alias replays them
  // at every place it is used, as compose-go's `cachedResolve` does.
  found: Map<Node, ComposePath[]>;
  // The containers being scanned. An alias back to one is a cycle.
  open: Set<Node>;
  tagged: number;
}

const resolveNode = (
  node: Node | undefined,
  doc: Document
): Node | undefined => (isAlias(node) ? node.resolve(doc) : node);

const tagOf = (node: Node | undefined, doc: Document): string | undefined =>
  resolveNode(node, doc)?.tag;

const isMergeTag = (tag: string | undefined): boolean =>
  tag === RESET_TAG || tag === OVERRIDE_TAG;

const countTagged = (scan: TagScan, count: number) => {
  scan.tagged += count;

  if (scan.tagged > MAX_TAGGED_VALUES) {
    throw new Error(
      `The file holds more than ${MAX_TAGGED_VALUES} !reset and !override values once its aliases are expanded`
    );
  }
};

// A `!reset` item leaves its sequence and a `!reset` pair its mapping
// (`loader/reset.go:204-208` and `:232-234`).
const dropResetValues = (container: YAMLMap | YAMLSeq, doc: Document) => {
  if (isSeq(container)) {
    container.items = container.items.filter(
      (item) => !(isNode(item) && tagOf(item, doc) === RESET_TAG)
    );

    return;
  }

  container.items = container.items.filter(
    (pair) => !(isNode(pair.value) && tagOf(pair.value, doc) === RESET_TAG)
  );
};

// With `merge: true`, yaml stores the value of a merge key as a symbol. Its
// source text is still `<<`.
const MERGE_KEY = "<<";

const keyOf = (pair: Pair): string => {
  if (!isScalar(pair.key)) {
    return "";
  }

  return pair.key.source === MERGE_KEY ? MERGE_KEY : String(pair.key.value);
};

// The keys whose values carry a merge tag. Paths below a sequence never
// match a base value (`loader/reset.go:307-316`), so a sequence has none.
const mergeTaggedKeys = (
  container: YAMLMap | YAMLSeq,
  doc: Document
): string[] =>
  isMap(container)
    ? container.items.flatMap((pair) =>
        isNode(pair.value) && isMergeTag(tagOf(pair.value, doc))
          ? [keyOf(pair)]
          : []
      )
    : [];

// The children to look inside, keyed by their mapping key, or by null in a
// sequence. compose-go does not look inside an `!override` value
// (`loader/reset.go:115-118`).
const untaggedChildren = (
  container: YAMLMap | YAMLSeq,
  doc: Document
): [string | null, Node][] => {
  const children: [string | null, Node][] = isMap(container)
    ? container.items.flatMap((pair) =>
        isNode(pair.value) ? [[keyOf(pair), pair.value]] : []
      )
    : container.items.flatMap((item) => (isNode(item) ? [[null, item]] : []));

  return children.filter(([, child]) => !isMergeTag(tagOf(child, doc)));
};

const scanTags = (node: Node | undefined, scan: TagScan): ComposePath[] => {
  const target = resolveNode(node, scan.doc);

  if (!(isMap(target) || isSeq(target)) || scan.open.has(target)) {
    return [];
  }

  const cached = scan.found.get(target);

  if (cached !== undefined) {
    countTagged(scan, cached.length);

    return cached;
  }

  scan.open.add(target);
  const paths: ComposePath[] = [];

  for (const key of mergeTaggedKeys(target, scan.doc)) {
    countTagged(scan, 1);
    paths.push([key]);
  }

  dropResetValues(target, scan.doc);

  for (const [key, child] of untaggedChildren(target, scan.doc)) {
    const below = scanTags(child, scan);

    if (key === null) {
      continue;
    }

    // compose-go drops the `<<` of a merge key from the path
    // (`loader/reset.go:106-109`).
    for (const path of below) {
      paths.push(key === MERGE_KEY ? path : [key, ...path]);
    }
  }

  scan.open.delete(target);
  scan.found.set(target, paths);

  return paths;
};

export const readComposeFile = (
  content: string,
  filepath: string
): ComposeFile => {
  let document: unknown;
  let replacedPaths: ComposePath[];

  try {
    // Compose files rely on YAML 1.1 merge keys (`<<: *anchor`); yaml's
    // default 1.2 schema leaves `<<` as a literal key without this option.
    const doc = parseDocument(content, {
      customTags: COMPOSE_TAGS,
      merge: true,
    });

    const [firstError] = doc.errors;

    if (firstError !== undefined) {
      throw firstError;
    }

    replacedPaths = scanTags(doc.contents ?? undefined, {
      doc,
      found: new Map(),
      open: new Set(),
      tagged: 0,
    });
    document = doc.toJS();
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

  return { document, replacedPaths };
};

export const parseCompose = (content: string, filepath: string): ComposeValue =>
  readComposeFile(content, filepath).document;

const isSequenceIndex = (segment: string | number): segment is number =>
  typeof segment === "number";

/**
 * Builds a {@link ComposeLocator} over the same source text a compose object
 * was parsed from, so rules can attach line numbers to their diagnostics.
 *
 * Keys pulled in via YAML merge keys (`<<: *anchor`) have no concrete node
 * at the merge site, so paths through them resolve to `undefined` and
 * callers fall back to an unnumbered diagnostic.
 */
export const createComposeLocator = (content: string): ComposeLocator => {
  const lineCounter = new LineCounter();
  const doc = parseDocument(content, { lineCounter, merge: true });

  // The offset of the last key or item on the path, or null when the path
  // leaves the document or that node has no position.
  const findOffset = (path: readonly (string | number)[]): number | null => {
    let node: unknown = doc.contents;
    let offset: number | null = null;

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
          return null;
        }

        offset = pair.key.range?.[0] ?? null;
        node = pair.value;
      } else if (isSeq(node) && isSequenceIndex(segment)) {
        // The parsed document has no `!reset` items, so they take no index.
        // A `!reset` pair stays findable: the runner reports a reset setting
        // at its key.
        const item = node.items.filter(
          (entry) => !(isNode(entry) && tagOf(entry, doc) === RESET_TAG)
        )[segment];

        if (item === undefined || item === null) {
          return null;
        }

        offset = isNode(item) ? (item.range?.[0] ?? null) : null;
        node = item;
      } else {
        return null;
      }
    }

    return offset;
  };

  return (path) => {
    const offset = findOffset(path);

    return offset === null ? undefined : lineCounter.linePos(offset).line;
  };
};
