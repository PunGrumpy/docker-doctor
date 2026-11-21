import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Glob } from "bun";
import { parseDocument } from "yaml";

import { readComposeFile } from "../src/parsers/compose-parser";
import { composeField } from "../src/parsers/compose-value";
import type { YamlValue } from "../src/parsers/yaml-to-js";
import { findAliasTargets, toJsValue } from "../src/parsers/yaml-to-js";

const PARSE_OPTIONS = {
  customTags: [
    { resolve: (): null => null, tag: "!reset" },
    {
      resolve: (source: string): string | null =>
        source === "" ? null : source,
      tag: "!override",
    },
  ],
  // yaml warns on stderr about every collection key the generator writes.
  logLevel: "error" as const,
  merge: true,
};

// yaml's `toJS()` is typed `any`. It builds only the values YamlValue names.
const isYamlValue = (value: unknown): value is YamlValue =>
  value !== undefined && typeof value !== "function";

type ObjectValue = Extract<YamlValue, object>;

const isObjectValue = (value: YamlValue): value is ObjectValue =>
  value !== null && typeof value === "object";

// Sets, maps and bytes, which compare by their members in order.
const hasMembers = (
  value: ObjectValue
): value is Set<YamlValue> | Map<YamlValue, YamlValue> | Uint8Array =>
  value instanceof Set || value instanceof Map || value instanceof Uint8Array;

type Compare = (left: YamlValue, right: YamlValue) => boolean;

const isSameContent = (
  left: ObjectValue,
  right: ObjectValue,
  compare: Compare
): boolean => {
  if (hasMembers(left) || hasMembers(right)) {
    return (
      hasMembers(left) && hasMembers(right) && compare([...left], [...right])
    );
  }

  if (left instanceof Date || right instanceof Date) {
    return (
      left instanceof Date &&
      right instanceof Date &&
      Object.is(left.getTime(), right.getTime())
    );
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => compare(item, right[index]))
    );
  }

  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => {
      const other = rightKeys[index];

      return (
        other !== undefined &&
        String(key) === String(other) &&
        compare(left[key], right[other])
      );
    })
  );
};

// Equal values of the same kind, with the same own keys or members in the
// same order. Shared and cyclic values compare by shape, since yaml copies
// what this shares.
const isSameValue = (
  left: YamlValue,
  right: YamlValue,
  seen = new Map<object, Set<object>>()
): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (
    !(isObjectValue(left) && isObjectValue(right)) ||
    Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)
  ) {
    return false;
  }

  const pairs = seen.get(left) ?? new Set<object>();

  if (pairs.has(right)) {
    return true;
  }

  pairs.add(right);
  seen.set(left, pairs);

  return isSameContent(left, right, (leftItem, rightItem) =>
    isSameValue(leftItem, rightItem, seen)
  );
};

type Outcome =
  | { kind: "value"; value: YamlValue }
  | { kind: "error"; message: string; overflowed: boolean };

const attempt = (build: () => YamlValue): Outcome => {
  try {
    return { kind: "value", value: build() };
  } catch (error: unknown) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
      overflowed: error instanceof RangeError,
    };
  }
};

const viaYaml = (text: string, maxAliasCount?: number): Outcome =>
  attempt(() => {
    const value: unknown = parseDocument(text, PARSE_OPTIONS).toJS(
      maxAliasCount === undefined ? {} : { maxAliasCount }
    );

    if (!isYamlValue(value)) {
      throw new TypeError("yaml built a value outside YamlValue");
    }

    return value;
  });

const viaTargets = (text: string): Outcome =>
  attempt(() => {
    const doc = parseDocument(text, PARSE_OPTIONS);

    return toJsValue(doc, findAliasTargets(doc));
  });

const isSameOutcome = (left: Outcome, right: Outcome): boolean => {
  if (left.kind === "value" && right.kind === "value") {
    return isSameValue(left.value, right.value);
  }

  return (
    left.kind === "error" &&
    right.kind === "error" &&
    left.message === right.message
  );
};

const parserRefusal = (text: string): string => {
  try {
    readComposeFile(text, "compose.yaml");

    return "";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

// Park and Miller's generator, so every run writes the same documents.
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const WARM_UP_DRAWS = 5;

const SCALARS = [
  "x",
  "1",
  "-2",
  "1.5",
  "0x1f",
  "1e3",
  ".inf",
  "true",
  "null",
  "~",
  "''",
  "'q s'",
  '"d\\tq"',
  "!reset",
  "!reset x",
  "!override v",
  "!override",
  "007",
] as const;

const KEYS = [
  "a",
  "b",
  "k",
  "__proto__",
  "toString",
  "constructor",
  "1",
  "'1'",
  "null",
  "~",
  "''",
  "true",
  "0",
  "'<<'",
  "!!str <<",
  "x y",
  "01",
  "1.0",
  "!override o",
] as const;

const ANCHORS = ["a", "b", "c", "d"] as const;

// Documents in flow style with odd keys, tags, collection keys, anchors that
// reuse a name, aliases, and merges of mappings, of other values and of the
// mapping being built. Without aliases they hold no anchor, alias or merge.
class DocumentWriter {
  readonly #anchors: string[] = [];
  readonly #mappingAnchors: string[] = [];
  #state: number;
  readonly #withAliases: boolean;

  constructor(seed: number, withAliases: boolean) {
    this.#state = seed;
    this.#withAliases = withAliases;

    for (let draw = 0; draw < WARM_UP_DRAWS; draw += 1) {
      this.#random();
    }
  }

  write(): string {
    const top = Array.from(
      { length: 1 + Math.floor(this.#random() * 5) },
      (_, index) => `t${index}: ${this.#value(4)}`
    );

    if (this.#anchors.length > 0 && this.#random() < 0.5) {
      top.push(`<<: ${this.#mergeAlias()}`);
    }

    return `${top.join("\n")}\n`;
  }

  #random(): number {
    this.#state = (this.#state * MULTIPLIER) % MODULUS;

    return this.#state / MODULUS;
  }

  #pick<T>(values: readonly T[]): T {
    const value = values[Math.floor(this.#random() * values.length)];

    if (value === undefined) {
      throw new RangeError("Nothing to pick from");
    }

    return value;
  }

  #anchor(isMapping: boolean): string {
    if (!this.#withAliases || this.#random() > 0.3) {
      return "";
    }

    const name = this.#pick(ANCHORS);

    this.#anchors.push(name);

    if (isMapping) {
      this.#mappingAnchors.push(name);
    }

    return `&${name} `;
  }

  #alias(): string {
    return `*${this.#pick(this.#anchors)}`;
  }

  #mergeAlias(): string {
    return this.#mappingAnchors.length > 0 && this.#random() < 0.85
      ? `*${this.#pick(this.#mappingAnchors)}`
      : this.#alias();
  }

  #value(depth: number): string {
    const roll = this.#random();

    if (this.#anchors.length > 0 && roll < 0.2) {
      return this.#alias();
    }

    if (depth <= 0 || roll < 0.45) {
      return this.#anchor(false) + this.#pick(SCALARS);
    }

    return roll < 0.75 ? this.#mapping(depth - 1) : this.#sequence(depth - 1);
  }

  #key(depth: number): string {
    const roll = this.#random();

    if (this.#anchors.length > 0 && roll < 0.05) {
      return `${this.#alias()} `;
    }

    if (depth > 0 && roll < 0.08) {
      return this.#sequence(1);
    }

    return depth > 0 && roll < 0.1 ? this.#mapping(1) : this.#pick(KEYS);
  }

  #mergeSource(depth: number): string {
    const roll = this.#random();

    if (roll < 0.6) {
      return this.#mergeAlias();
    }

    return roll < 0.85
      ? `[${this.#mergeAlias()}, ${this.#mergeAlias()}]`
      : this.#mapping(depth);
  }

  #mapping(depth: number): string {
    const prefix = this.#anchor(true);
    const keys = new Set<string>();
    const pairs: string[] = [];

    for (let count = Math.floor(this.#random() * 5); count > 0; count -= 1) {
      if (this.#anchors.length > 0 && this.#random() < 0.25) {
        pairs.push(`<<: ${this.#mergeSource(depth - 1)}`);
      } else {
        const key = this.#key(depth);

        if (!keys.has(key)) {
          keys.add(key);
          pairs.push(`${key}: ${this.#value(depth)}`);
        }
      }
    }

    return `${prefix}{${pairs.join(", ")}}`;
  }

  #sequence(depth: number): string {
    const prefix = this.#anchor(false);

    const items = Array.from({ length: Math.floor(this.#random() * 4) }, () =>
      this.#value(depth)
    );

    return `${prefix}[${items.join(", ")}]`;
  }
}

// Each generated document, and the same document as yaml writes it in block
// style, when it parses.
const generatedDocuments = (count: number, withAliases: boolean): string[] =>
  Array.from({ length: count }, (_, index) => {
    const text = new DocumentWriter(index + 1, withAliases).write();
    const doc = parseDocument(text, PARSE_OPTIONS);

    return doc.errors.length > 0 ? [] : [text, doc.toString()];
  }).flat();

// One scalar anchor used `count` times, or `count` anchors used once each.
const manyAliases = (count: number, isDistinct: boolean): string => {
  const anchors = Array.from({ length: isDistinct ? count : 1 }, (_, index) =>
    isDistinct ? `  - &v${index} value${index}` : "  - &v0 value0"
  );

  const uses = Array.from(
    { length: count },
    (_, index) => `  - *v${isDistinct ? index : 0}`
  );

  return ["anchors:", ...anchors, "uses:", ...uses, ""].join("\n");
};

// Odd numbers written in every tagged document below.
const ODD_NUMBERS =
  "[!!float .inf, !!float .nan, -.inf, !!int 123456789012345678901234567890]";

// A tagged value in extension fields and in a service, alone, behind an
// alias, behind a merge key and as a mapping key.
const taggedDocument = (value: string): string =>
  [
    `x-value: &v ${value}`,
    "x-alias: *v",
    `x-key: {? ${value} : 1}`,
    `x-numbers: &n ${ODD_NUMBERS}`,
    `x-base: &base {merged: ${value}, numbers: *n}`,
    "services:",
    "  web:",
    "    image: alpine:3.21",
    `    labels: ${value}`,
    "    x-alias: *v",
    "    <<: *base",
    "",
  ].join("\n");

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const SEEDS = 400;

// The generated documents take about a second here, and CI runners are 5
// to 10 times slower.
const GENERATED_TIMEOUT_MS = 30_000;

// The values match yaml's own `toJS()`, which binds each alias by walking the
// document and which this test runs with its alias cap off.
describe("toJsValue", () => {
  test("builds every Compose fixture in the repository as yaml does", () => {
    const texts = [
      ...new Glob("packages/*/test/fixtures/**/*.{yaml,yml}").scanSync(
        REPO_ROOT
      ),
    ].flatMap((file) => {
      const text = readFileSync(`${REPO_ROOT}/${file}`, "utf-8");

      return parseDocument(text, PARSE_OPTIONS).errors.length > 0 ? [] : [text];
    });

    expect(texts.length).toBeGreaterThan(10);

    for (const text of texts) {
      expect(isSameOutcome(viaTargets(text), viaYaml(text))).toBe(true);
    }
  });

  // The bound is loose on purpose. yaml's `toJS()` walks the anchors up to
  // each alias and takes seconds on these documents, and CI runners are 5 to
  // 10 times slower than a laptop.
  test.each([
    ["one anchor used 50,000 times", 50_000, false],
    ["20,000 anchors used once each", 20_000, true],
  ])("builds %s in linear time", (_name, count, isDistinct) => {
    const doc = parseDocument(manyAliases(count, isDistinct), PARSE_OPTIONS);
    const start = performance.now();
    const targets = findAliasTargets(doc);
    const value = toJsValue(doc, targets);

    expect(performance.now() - start).toBeLessThan(1000);
    expect(value).toMatchObject({
      uses: Array.from(
        { length: count },
        (_, index) => `value${isDistinct ? index : 0}`
      ),
    });
  });

  // yaml reads `&b` again when `*b` inside the merged mapping asks for it,
  // and that reading sees the merge it sits in.
  test("a merge reached while its mapping is read sees that mapping as yaml does", () => {
    const text = "t0: {<<: &b {<<: {1: *b, a: v}, k: w}}\n";

    expect(isSameOutcome(viaTargets(text), viaYaml(text))).toBe(true);
  });

  test.each([
    ["a binary value", "!!binary SGVsbG8="],
    ["a timestamp", "!!timestamp 2001-12-14T21:59:43Z"],
    ["a set", "!!set {a, b}"],
    ["an ordered map", "!!omap [a: 1, b: 2]"],
    ["pairs", "!!pairs [a: 1, a: 2, <<: {k: v}]"],
  ])("builds %s as yaml does", (_name, value) => {
    const text = taggedDocument(value);

    expect(viaYaml(text).kind).toBe("value");
    expect(isSameOutcome(viaTargets(text), viaYaml(text))).toBe(true);
  });

  // A document that ends with `...` must not leave the marker in the names
  // of its collection keys.
  test("names a collection key without the document's end marker, as yaml does", () => {
    const text = [
      "x-k:",
      "  ? [a]",
      "  : 1",
      "services:",
      "  web:",
      "    image: alpine:3.21",
      "...",
      "",
    ].join("\n");

    const built = viaTargets(text);

    expect(isSameOutcome(built, viaYaml(text))).toBe(true);
    expect(built).toMatchObject({
      kind: "value",
      value: { "x-k": { "[ a ]": 1 } },
    });
  });

  // yaml reads a merged set with the loop it reads a merged map's entries
  // with, so each member comes apart as a [key, value] pair.
  test("a merged set comes apart into keys and values as in yaml", () => {
    const text = [
      "x-set: &s !!set {ab, cd, e}",
      "services:",
      "  web:",
      "    image: alpine:3.21",
      "    <<: *s",
      "",
    ].join("\n");

    expect(viaYaml(text)).toMatchObject({
      kind: "value",
      value: { services: { web: { a: "b", c: "d" } } },
    });

    const built = viaTargets(text);

    expect(isSameOutcome(built, viaYaml(text))).toBe(true);

    if (built.kind !== "value" || !isObjectValue(built.value)) {
      throw new TypeError("the builder produced no document");
    }

    const document = built.value;

    if (!("services" in document)) {
      throw new TypeError("the document has no services entry");
    }

    const { services } = document;

    if (!isObjectValue(services) || !("web" in services)) {
      throw new TypeError("the services entry has no web service");
    }

    const { web } = services;

    if (!isObjectValue(web)) {
      throw new TypeError("the web service is not a mapping");
    }

    const member = Object.getOwnPropertyDescriptor(web, "e");

    expect(member).toBeDefined();
    expect(member?.value).toBeUndefined();
  });

  // The engines word the error differently, so only the refusal is compared.
  test("a merged set with a member that is not a pair is refused as in yaml", () => {
    const text = "x-set: &s !!set {1, 2}\nx-merge: {<<: *s}\n";

    expect(viaYaml(text).kind).toBe("error");
    expect(viaTargets(text).kind).toBe("error");
  });

  test.each([
    ["binary", "!!binary SGVsbG8="],
    ["timestamp", "!!timestamp 2001-12-14T21:59:43Z"],
  ])("the parser reads a file with a %s extension field", (_name, value) => {
    const text = [
      `x-meta: ${value}`,
      "services:",
      "  web:",
      "    image: alpine:3.21",
      "",
    ].join("\n");

    expect(
      composeField(
        composeField(
          composeField(
            readComposeFile(text, "compose.yaml").document,
            "services"
          ),
          "web"
        ),
        "image"
      )
    ).toBe("alpine:3.21");
  });

  test.each([
    ["without aliases", false],
    ["with anchors, aliases and merge keys", true],
  ])(
    "builds generated documents %s as yaml does",
    (_name, withAliases) => {
      let built = 0;

      for (const text of generatedDocuments(SEEDS, withAliases)) {
        const expected = viaYaml(text, -1);

        if (expected.kind === "value" || !expected.overflowed) {
          expect(isSameOutcome(viaTargets(text), expected)).toBe(true);
          built += expected.kind === "value" ? 1 : 0;
        }
      }

      expect(built).toBeGreaterThan(SEEDS / 2);
    },
    GENERATED_TIMEOUT_MS
  );

  // yaml copies a merged mapping again at every merge, and a merge that
  // reaches its own mapping overflows the stack. A `!reset` value can drop
  // the merge before the parser reads it, so those documents are left out.
  test(
    "the parser refuses by name the merges that overflow yaml's stack, and no others",
    () => {
      const cycle = "A merge key merges a mapping into itself";
      let refused = 0;

      for (const text of generatedDocuments(SEEDS, true)) {
        const expected = viaYaml(text, -1);
        const isRefused = parserRefusal(text).includes(cycle);

        if (expected.kind === "value") {
          expect(isRefused).toBe(false);
        } else if (expected.overflowed && !text.includes("!reset")) {
          expect(isRefused).toBe(true);
          refused += 1;
        }
      }

      expect(refused).toBeGreaterThan(10);
    },
    GENERATED_TIMEOUT_MS
  );
});
