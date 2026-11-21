import type { Document, Node, Pair, YAMLMap, YAMLSeq } from "yaml";
import {
  isAlias,
  isCollection,
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
} from "yaml";

import { ParseError } from "../errors";
import type { ComposeLocator, ComposeValue } from "../types/index";
import { isComposeValue } from "./compose-value";
import type { AliasTargets } from "./yaml-to-js";
import { findAliasTargets, isMergeKey, toJsValue } from "./yaml-to-js";

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
  // Relative paths found below each container, kept so an alias replays them
  // at every place it is used, as compose-go's `cachedResolve` does.
  found: Map<Node, ComposePath[]>;
  // The containers being scanned. An alias back to one is a cycle.
  open: Set<Node>;
  tagged: number;
  targets: AliasTargets;
}

const resolveNode = (
  node: Node | undefined,
  targets: AliasTargets
): Node | undefined => (isAlias(node) ? targets.get(node) : node);

const tagOf = (
  node: Node | undefined,
  targets: AliasTargets
): string | undefined => resolveNode(node, targets)?.tag;

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
const dropResetValues = (
  container: YAMLMap | YAMLSeq,
  targets: AliasTargets
) => {
  if (isSeq(container)) {
    container.items = container.items.filter(
      (item) => !(isNode(item) && tagOf(item, targets) === RESET_TAG)
    );

    return;
  }

  container.items = container.items.filter(
    (pair) => !(isNode(pair.value) && tagOf(pair.value, targets) === RESET_TAG)
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

// compose-go decodes a file with go-yaml's default alias check
// (`loader/reset.go:80`, and go.yaml.in/yaml/v4 v4.0.0
// `internal/libyaml/options.go:118-140`). It counts every value it builds,
// counts again as repeated each value an alias stands for, and refuses a
// file whose repeated values pass a share that shrinks as the file grows.
// go-yaml checks as it builds and this checks the totals, so a file whose
// written values make up the share only after its aliases passes here.
const UNCHECKED_REPEATED_VALUES = 100;
const UNCHECKED_VALUES = 1000;
const SHRINK_FROM_VALUES = 400_000;
const SHRINK_TO_VALUES = 4_000_000;
const LARGEST_REPEATED_SHARE = 0.99;
const SMALLEST_REPEATED_SHARE = 0.1;

// compose-go does not count merged values as repeats, so the share alone
// lets a chain of merge keys grow a file without limit. The largest ordinary
// file found, 500 services that merge a common block, expands to about
// 146,000 values.
const MAX_EXPANDED_VALUES = 1_000_000;

const allowedRepeatedShare = (values: number): number => {
  if (values <= SHRINK_FROM_VALUES) {
    return LARGEST_REPEATED_SHARE;
  }

  if (values >= SHRINK_TO_VALUES) {
    return SMALLEST_REPEATED_SHARE;
  }

  const progress =
    (values - SHRINK_FROM_VALUES) / (SHRINK_TO_VALUES - SHRINK_FROM_VALUES);

  return (
    LARGEST_REPEATED_SHARE -
    (LARGEST_REPEATED_SHARE - SMALLEST_REPEATED_SHARE) * progress
  );
};

// The values a node stands for once its aliases and merge keys are applied,
// and how many of them an alias repeats.
interface Expansion {
  repeated: number;
  values: number;
}

const ONE_VALUE: Expansion = { repeated: 0, values: 1 };

const NO_VALUES: Expansion = { repeated: 0, values: 0 };

interface Sizing {
  // The containers being sized. An alias back to one is a cycle.
  open: Set<Node>;
  sizes: Map<Node, Expansion>;
  targets: AliasTargets;
}

const addExpansions = (left: Expansion, right: Expansion): Expansion => ({
  repeated: left.repeated + right.repeated,
  values: left.values + right.values,
});

// yaml copies a merged mapping again at every merge, so a merge key that
// reaches a mapping it sits in would recurse until the stack overflows. The
// mappings are checked at each merge key, before the sizes of the
// containers holding them are reused.
const refuseMergeCycle = (value: Node, sizing: Sizing) => {
  const source = resolveNode(value, sizing.targets);
  const merged = isSeq(source) ? source.items : [source];

  for (const item of merged) {
    const mapping = isNode(item) ? resolveNode(item, sizing.targets) : item;

    // yaml refuses a source that is not a mapping before it reads the next.
    if (!isMap(mapping)) {
      return;
    }

    if (sizing.open.has(mapping)) {
      throw new Error("A merge key merges a mapping into itself");
    }
  }
};

// Each container is sized once, so a chain of anchors that doubles at every
// step costs linear time to measure. An alias inside its own anchor counts
// once, as the tag scan does. compose-go puts the mapping in place of the
// alias in `<<: *x` before go-yaml reads it (`loader/reset.go:235-244`), so
// those values count as written. The aliases in `<<: [*a, *b]` stay aliases.
const expandedSize = (node: Node | Pair, sizing: Sizing): Expansion => {
  if (isPair(node)) {
    const key = isNode(node.key) ? expandedSize(node.key, sizing) : NO_VALUES;

    if (!isNode(node.value)) {
      return key;
    }

    if (!isMergeKey(node.key)) {
      return addExpansions(key, expandedSize(node.value, sizing));
    }

    refuseMergeCycle(node.value, sizing);

    const merged = resolveNode(node.value, sizing.targets);

    return addExpansions(
      key,
      merged === undefined ? ONE_VALUE : expandedSize(merged, sizing)
    );
  }

  if (isAlias(node)) {
    const target = sizing.targets.get(node);

    if (target === undefined || sizing.open.has(target)) {
      return ONE_VALUE;
    }

    const { values } = expandedSize(target, sizing);

    return { repeated: values, values: values + 1 };
  }

  if (!isCollection(node) || sizing.open.has(node)) {
    return ONE_VALUE;
  }

  const known = sizing.sizes.get(node);

  if (known !== undefined) {
    return known;
  }

  sizing.open.add(node);
  let size = ONE_VALUE;

  for (const item of node.items) {
    if (isNode(item) || isPair(item)) {
      size = addExpansions(size, expandedSize(item, sizing));
    }
  }

  sizing.open.delete(node);
  sizing.sizes.set(node, size);

  return size;
};

const checkAliasing = (doc: Document, targets: AliasTargets) => {
  const { repeated, values } =
    doc.contents === null
      ? NO_VALUES
      : expandedSize(doc.contents, {
          open: new Set(),
          sizes: new Map(),
          targets,
        });

  // A deep enough chain of anchors expands past the largest number, and
  // this refuses it before the share is computed.
  if (values > MAX_EXPANDED_VALUES) {
    throw new Error(
      `The file expands to more than ${MAX_EXPANDED_VALUES.toLocaleString("en-US")} values once its aliases and merge keys are applied`
    );
  }

  const allowedShare = allowedRepeatedShare(values);

  const isRefused =
    repeated > UNCHECKED_REPEATED_VALUES &&
    values > UNCHECKED_VALUES &&
    repeated / values > allowedShare;

  if (isRefused) {
    const percent = Number((allowedShare * 100).toFixed(1));

    throw new Error(
      `The file's aliases repeat ${repeated.toLocaleString("en-US")} of its ${values.toLocaleString("en-US")} values, more than the ${percent}% that Compose's YAML decoder allows`
    );
  }
};

// The keys whose values carry a merge tag. Paths below a sequence never
// match a base value (`loader/reset.go:307-316`), so a sequence has none.
const mergeTaggedKeys = (
  container: YAMLMap | YAMLSeq,
  targets: AliasTargets
): string[] =>
  isMap(container)
    ? container.items.flatMap((pair) =>
        isNode(pair.value) && isMergeTag(tagOf(pair.value, targets))
          ? [keyOf(pair)]
          : []
      )
    : [];

// The children to look inside, keyed by their mapping key, or by null in a
// sequence. compose-go does not look inside an `!override` value
// (`loader/reset.go:115-118`).
const untaggedChildren = (
  container: YAMLMap | YAMLSeq,
  targets: AliasTargets
): [string | null, Node][] => {
  const children: [string | null, Node][] = isMap(container)
    ? container.items.flatMap((pair) =>
        isNode(pair.value) ? [[keyOf(pair), pair.value]] : []
      )
    : container.items.flatMap((item) => (isNode(item) ? [[null, item]] : []));

  return children.filter(([, child]) => !isMergeTag(tagOf(child, targets)));
};

const scanTags = (node: Node | undefined, scan: TagScan): ComposePath[] => {
  const target = resolveNode(node, scan.targets);

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

  for (const key of mergeTaggedKeys(target, scan.targets)) {
    countTagged(scan, 1);
    paths.push([key]);
  }

  dropResetValues(target, scan.targets);

  for (const [key, child] of untaggedChildren(target, scan.targets)) {
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

    const targets = findAliasTargets(doc);

    replacedPaths = scanTags(doc.contents ?? undefined, {
      found: new Map(),
      open: new Set(),
      tagged: 0,
      targets,
    });
    // Counted after the scan has dropped the `!reset` values, as compose-go
    // counts them.
    checkAliasing(doc, targets);
    document = toJsValue(doc, targets);
  } catch (error: unknown) {
    throw new ParseError({ file: filepath, message: describeYamlError(error) });
  }

  // The document holds only scalar values, arrays and objects, so no YAML
  // text reaches this error.
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
  const targets = findAliasTargets(doc);

  // The offset of the last key or item on the path, or null when the path
  // leaves the document or that node has no position.
  const findOffset = (path: readonly (string | number)[]): number | null => {
    let node: unknown = doc.contents;
    let offset: number | null = null;

    for (const segment of path) {
      if (isAlias(node)) {
        node = targets.get(node);
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
          (entry) => !(isNode(entry) && tagOf(entry, targets) === RESET_TAG)
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
