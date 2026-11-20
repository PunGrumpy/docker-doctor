import type { Alias, Document, Node, Pair } from "yaml";
import {
  Document as YamlDocument,
  isAlias,
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  Scalar,
  visit,
  YAMLMap,
  YAMLSeq,
} from "yaml";

// Each alias and the node it names: the last node before it with its anchor,
// the node yaml's `Alias.resolve` finds. That method walks the document up
// to the alias on every call. This map is built in one walk.
export type AliasTargets = ReadonlyMap<Alias, Node>;

export const findAliasTargets = (doc: Document): AliasTargets => {
  const targets = new Map<Alias, Node>();
  const anchored = new Map<string, Node>();

  visit(doc, (_key, node) => {
    if (isAlias(node)) {
      const target = anchored.get(node.source);

      if (target !== undefined) {
        targets.set(node, target);
      }
    } else if (isNode(node) && node.anchor !== undefined) {
      anchored.set(node.anchor, node);
    }
  });

  return targets;
};

const MERGE_KEY = "<<";

// A key yaml merges on: a plain `<<`, which its merge tag reads as a symbol.
export const isMergeKey = (key: unknown): key is Scalar => {
  if (!isScalar(key)) {
    return false;
  }

  const { value } = key;

  if (typeof value === "symbol") {
    return value.description === MERGE_KEY;
  }

  const isPlain = key.type === undefined || key.type === Scalar.PLAIN;

  return isPlain && value === MERGE_KEY;
};

// A scalar's value in the core schema with Compose's two tags, a `Date` or
// bytes from the timestamp and binary tags yaml always knows, or the symbol of
// a `<<` key.
type YamlScalar =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | Date
  | Uint8Array;

export type YamlValue =
  | YamlScalar
  | YamlValue[]
  | YamlObject
  | Set<YamlValue>
  | Map<YamlValue, YamlValue>;

export interface YamlObject {
  [name: string]: YamlValue;
  [name: symbol]: YamlValue;
}

// yaml builds a mapping with this tag as a `Set` of its keys, and a sequence
// with the other as a `Map`. A document whose tag does not resolve has errors,
// which the parser refuses before it builds.
const SET_TAG = "tag:yaml.org,2002:set";
const ORDERED_MAP_TAG = "tag:yaml.org,2002:omap";

const SCALAR_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
]);

// Every value yaml resolves a scalar to with the parser's options.
const isYamlScalar = (value: unknown): value is YamlScalar =>
  value === null ||
  SCALAR_TYPES.has(typeof value) ||
  value instanceof Date ||
  value instanceof Uint8Array;

const isIterable = (
  value: YamlValue
): value is Extract<YamlValue, Iterable<unknown>> =>
  typeof value === "string" ||
  (typeof value === "object" && value !== null && Symbol.iterator in value);

// The [key, value] pair a destructuring loop takes from a merged set's
// member. A member of one character leaves the value undefined, as in yaml.
const memberEntry = (member: YamlValue): [YamlValue, YamlValue] => {
  if (!isIterable(member)) {
    throw new TypeError("A merged set holds a member that is not iterable");
  }

  const [key, value] = member;

  return [key, value];
};

const isSymbol = (value: YamlValue): value is symbol =>
  typeof value === "symbol";

const isScalarValue = (value: YamlValue): value is YamlScalar =>
  value === null || typeof value !== "object";

// The property name JavaScript makes of any value, as yaml's merge does when
// it copies a key into an object. A collection key gets the engine's own
// name for it, "[object Object]" for a mapping.
const toPropertyKey = (key: YamlValue): PropertyKey => {
  if (key === null) {
    return "null";
  }

  // oxlint-disable-next-line typescript/no-base-to-string -- the engine's default name is the one yaml gives
  return isSymbol(key) ? key : String(key);
};

const setProperty = (map: YamlObject, name: PropertyKey, value: YamlValue) => {
  Object.defineProperty(map, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const scalarName = (value: YamlScalar): string =>
  value === null ? "" : String(value);

const TRAILING_NEWLINE = /\n$/u;

// yaml names a property after a collection key with the key's flow YAML,
// written without the key's own anchor, tag and comments. Compose refuses
// such keys, and this keeps the names yaml gives them.
const collectionKeyText = (key: YAMLMap | YAMLSeq, doc: Document): string => {
  const probe = new YamlDocument();

  probe.contents = isMap(key)
    ? Object.assign(new YAMLMap(), { items: key.items })
    : Object.assign(new YAMLSeq(), { items: key.items });
  probe.directives = doc.directives;
  probe.schema = doc.schema;

  return probe
    .toString({
      collectionStyle: "flow",
      directives: false,
      verifyAliasOrder: false,
    })
    .replace(TRAILING_NEWLINE, "");
};

const nodeOrNull = (pair: Pair, side: "key" | "value"): Node | null => {
  const node = pair[side];

  return isNode(node) ? node : null;
};

class YamlBuilder {
  // One value per container, registered before it is filled, so an alias
  // inside its own anchor shares the value as yaml's does.
  readonly #built = new Map<Node, YamlValue>();
  readonly #doc: Document;
  // The entries each merged mapping adds, keyed by each key's value, in
  // yaml's order.
  readonly #merged = new Map<YAMLMap, Map<YamlValue, YamlValue>>();
  readonly #merging = new Set<YAMLMap>();
  readonly #targets: AliasTargets;

  constructor(doc: Document, targets: AliasTargets) {
    this.#doc = doc;
    this.#targets = targets;
  }

  build(node: Node | null): YamlValue {
    if (node === null) {
      return null;
    }

    if (isAlias(node)) {
      return this.build(this.#target(node));
    }

    // yaml's `toJS()` returns a scalar's value as its tag resolved it.
    if (isScalar(node)) {
      if (!isYamlScalar(node.value)) {
        throw new TypeError("A YAML scalar holds a value of an unknown type");
      }

      return node.value;
    }

    const built = this.#built.get(node);

    if (built !== undefined) {
      return built;
    }

    if (isSeq(node)) {
      return node.tag === ORDERED_MAP_TAG
        ? this.#buildOrderedMap(node)
        : this.#buildSeq(node);
    }

    if (node.tag === SET_TAG) {
      return this.#buildSet(node);
    }

    const map: YamlObject = {};

    this.#built.set(node, map);

    for (const pair of node.items) {
      this.#addPair(map, pair);
    }

    return map;
  }

  #target(alias: Alias): Node {
    const target = this.#targets.get(alias);

    if (target === undefined) {
      throw new ReferenceError(
        `Unresolved alias (the anchor must be set before the alias): ${alias.source}`
      );
    }

    return target;
  }

  #buildSeq(node: YAMLSeq): YamlValue[] {
    const seq: YamlValue[] = [];

    this.#built.set(node, seq);

    // yaml reads a pair in a flow sequence, as in `[a: 1]`, as a mapping.
    // Only the pairs tag keeps an item as a pair, and yaml builds it as a
    // mapping of its own.
    for (const item of node.items) {
      if (isPair(item)) {
        const map: YamlObject = {};

        this.#addPair(map, item);
        seq.push(map);
      } else {
        seq.push(this.build(isNode(item) ? item : null));
      }
    }

    return seq;
  }

  // yaml's reading of an ordered map. It merges nothing, so `<<` stays a
  // symbol key.
  #buildOrderedMap(node: YAMLSeq): Map<YamlValue, YamlValue> {
    const map = new Map<YamlValue, YamlValue>();

    this.#built.set(node, map);

    for (const item of node.items) {
      if (isPair(item)) {
        const key = this.build(nodeOrNull(item, "key"));
        const value = this.build(nodeOrNull(item, "value"));

        if (map.has(key)) {
          throw new Error("Ordered maps must not include duplicate keys");
        }

        map.set(key, value);
      }
    }

    return map;
  }

  // yaml builds a set as it builds a mapping, into a `Set` that takes only
  // the keys.
  #buildSet(node: YAMLMap): Set<YamlValue> {
    const built = this.#built.get(node);

    if (built instanceof Set) {
      return built;
    }

    const set = new Set<YamlValue>();

    this.#built.set(node, set);

    for (const pair of node.items) {
      this.#addPair(set, pair);
    }

    return set;
  }

  #addPair(map: YamlObject | Set<YamlValue>, pair: Pair) {
    if (isMergeKey(pair.key)) {
      this.#mergeInto(map, nodeOrNull(pair, "value"));

      return;
    }

    const key = nodeOrNull(pair, "key");

    if (map instanceof Set) {
      map.add(this.build(key));

      return;
    }

    const name = this.#propertyName(key, this.build(key));

    setProperty(map, name, this.build(nodeOrNull(pair, "value")));
  }

  #propertyName(key: Node | null, value: YamlValue): string {
    if (isScalarValue(value)) {
      return scalarName(value);
    }

    if (isAlias(key)) {
      return `*${key.source}`;
    }

    // yaml names a scalar key holding a `Date` or bytes with the value's own
    // `toString`.
    if (value instanceof Date || value instanceof Uint8Array) {
      return String(value);
    }

    return isMap(key) || isSeq(key) ? collectionKeyText(key, this.#doc) : "";
  }

  // The YAML 1.1 merge rule as yaml applies it: each source adds the keys the
  // map does not hold yet, earlier sources first.
  #mergeInto(
    map: YamlObject | Map<YamlValue, YamlValue> | Set<YamlValue>,
    value: Node | null
  ) {
    const source = isAlias(value) ? this.#targets.get(value) : value;
    const sources = isSeq(source) ? source.items : [source];

    for (const item of sources) {
      const mapping = isAlias(item) ? this.#targets.get(item) : item;

      if (!isMap(mapping)) {
        throw new Error("Merge sources must be maps or map aliases");
      }

      for (const [key, entry] of this.#mergedEntries(mapping)) {
        if (map instanceof Map) {
          if (!map.has(key)) {
            map.set(key, entry);
          }
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.hasOwn(map, toPropertyKey(key))) {
          setProperty(map, toPropertyKey(key), entry);
        }
      }
    }
  }

  // yaml reads a merged mapping into a `Map` keyed by each key's value, and
  // copies those keys, not the property names the mapping has on its own. It
  // reads a merged set as a `Set`, and its loop over the entries takes each
  // member apart as a [key, value] pair.
  #mergedEntries(mapping: YAMLMap): Iterable<[YamlValue, YamlValue]> {
    if (mapping.tag === SET_TAG) {
      return [...this.#buildSet(mapping)].map(memberEntry);
    }

    const known = this.#merged.get(mapping);

    if (known !== undefined) {
      return known;
    }

    // yaml reads the mapping again at every merge. A merge reached while the
    // same mapping is being read sees the values built so far, so it is read
    // again here too, and only a finished reading is kept.
    const isReread = this.#merging.has(mapping);
    const entries = new Map<YamlValue, YamlValue>();

    this.#merging.add(mapping);

    for (const pair of mapping.items) {
      if (isMergeKey(pair.key)) {
        this.#mergeInto(entries, nodeOrNull(pair, "value"));
      } else {
        const key = this.build(nodeOrNull(pair, "key"));

        entries.set(key, this.build(nodeOrNull(pair, "value")));
      }
    }

    if (!isReread) {
      this.#merging.delete(mapping);
      this.#merged.set(mapping, entries);
    }

    return entries;
  }
}

/**
 * The document as yaml's `toJS()` builds it, with each alias bound through
 * `targets`. A merged mapping is read once and its keys copied at each merge,
 * so the cost grows with the written nodes and the merged keys.
 */
export const toJsValue = (doc: Document, targets: AliasTargets): YamlValue =>
  new YamlBuilder(doc, targets).build(doc.contents);
