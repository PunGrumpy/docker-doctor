import { describe, expect, test } from "bun:test";

import { ParseError } from "../src/errors";
import {
  createComposeLocator,
  readComposeFile,
} from "../src/parsers/compose-parser";

// Service `s<i>` defines `environment: &e<i>` and `x-more` uses each anchor
// once, so the file holds `count` distinct aliases.
const distinctAliases = (count: number): string => {
  const services = Array.from(
    { length: count },
    (_, index) =>
      `  s${index}:\n    image: nginx:1.27.3\n    environment: &e${index}\n      A: "1"`
  );

  const uses = Array.from(
    { length: count },
    (_, index) => `  m${index}: *e${index}`
  );

  return ["services:", ...services, "x-more:", ...uses, ""].join("\n");
};

// Every service merges the same two-key anchor, as many real files do.
const sharedAnchor = (services: number): string => {
  const uses = Array.from(
    { length: services },
    (_, index) => `  s${index}:\n    <<: *default\n    image: nginx:1.27.3`
  );

  return [
    "x-common: &default",
    "  restart: always",
    "  init: true",
    "services:",
    ...uses,
    "",
  ].join("\n");
};

// Each anchor lists the one before it `width` times, so the last one expands
// to `width ** depth` values.
const anchorChain = (depth: number, width: number): string => {
  const levels = Array.from({ length: depth }, (_, index) => {
    const refs = Array.from({ length: width }, () => `*l${index}`);

    return `x${index + 1}: &l${index + 1} [${refs.join(", ")}]`;
  });

  return [
    "x0: &l0 [lol]",
    ...levels,
    `services:\n  web:\n    image: nginx:1.27.3\n    command: *l${depth}`,
    "",
  ].join("\n");
};

// An anchor of `variables` environment entries that every service merges.
const sharedEnvironment = (variables: number, services: number): string => {
  const environment = Array.from(
    { length: variables },
    (_, index) => `    VAR_${index}: value-${index}`
  );

  const uses = Array.from(
    { length: services },
    (_, index) => `  s${index}:\n    <<: *common`
  );

  return [
    "x-common: &common",
    "  image: nginx:1.27.3",
    "  environment:",
    ...environment,
    "services:",
    ...uses,
    "",
  ].join("\n");
};

// An anchor of `keys` plain values merged into `services` services. The file
// expands to `expandedValues(keys, services)` values: each mapping, key and
// value is one, and a merge stands for the anchor's values.
const mergedKeys = (keys: number, services: number): string => {
  const entries = Array.from({ length: keys }, (_, index) => `  k${index}: v`);

  const uses = Array.from(
    { length: services },
    (_, index) => `  s${index}: {<<: *keys}`
  );

  return ["x-keys: &keys", ...entries, "services:", ...uses, ""].join("\n");
};

const expandedValues = (keys: number, services: number): number => {
  const anchor = 1 + 2 * keys;
  const service = 1 + 1 + 1 + anchor;

  return 1 + (1 + anchor) + (1 + 1 + services * service);
};

describe("Compose aliases", () => {
  test.each([100, 1000])(
    "an anchor merged into %d services parses, as Compose accepts it",
    (services) => {
      const { document } = readComposeFile(
        sharedAnchor(services),
        "compose.yaml"
      );

      expect(document).toMatchObject({
        services: {
          [`s${services - 1}`]: {
            image: "nginx:1.27.3",
            init: true,
            restart: "always",
          },
        },
      });
    }
  );

  // The bound is loose because CI runners are 5 to 10 times slower than a
  // laptop. Expanding either file before refusing it would never finish.
  test.each([
    ["nine levels of nine aliases", 9, 9],
    ["an expansion past the largest number", 1100, 2],
  ])("a chain of anchors with %s is refused quickly", (_name, depth, width) => {
    const start = performance.now();

    expect(() =>
      readComposeFile(anchorChain(depth, width), "compose.yaml")
    ).toThrow(ParseError);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  // compose-go puts the mapping in place of `<<: *common` before go-yaml
  // reads it, so merged values are not repeats, and Compose loads these.
  test.each([
    [200, 985],
    [100, 2099],
  ])(
    "an anchor of %d variables merged into %d services parses",
    (variables, services) => {
      const { document } = readComposeFile(
        sharedEnvironment(variables, services),
        "compose.yaml"
      );

      expect(document).toMatchObject({
        services: {
          [`s${services - 1}`]: {
            environment: { [`VAR_${variables - 1}`]: `value-${variables - 1}` },
            image: "nginx:1.27.3",
          },
        },
      });
    }
  );

  test("a file that expands to the most values allowed parses", () => {
    const keys = 500;
    const services = 995;

    expect(expandedValues(keys, services)).toBeLessThanOrEqual(1_000_000);
    expect(expandedValues(keys, services + 1)).toBeGreaterThan(1_000_000);
    expect(() =>
      readComposeFile(mergedKeys(keys, services), "compose.yaml")
    ).not.toThrow();
  });

  test("a file that expands past the most values allowed is refused", () => {
    expect(() => readComposeFile(mergedKeys(500, 996), "compose.yaml")).toThrow(
      "The file expands to more than 1,000,000 values once its aliases and merge keys are applied"
    );
  });

  test("aliases that repeat almost every value are refused by Compose's share", () => {
    expect(() => readComposeFile(anchorChain(3, 9), "compose.yaml")).toThrow(
      "The file's aliases repeat 4,996 of its 5,041 values, more than the 99% that Compose's YAML decoder allows"
    );
  });

  // compose-go counts the values go-yaml builds after the `!reset` values
  // are gone, so an anchor of reset values repeats almost nothing.
  test("repeated !reset values do not count toward the share", () => {
    const resets = Array.from(
      { length: 500 },
      (_, index) => `  r${index}: !reset null`
    );

    const uses = Array.from(
      { length: 190 },
      (_, index) => `  x-${index}: *resets`
    );

    const content = [
      "x-resets: &resets",
      ...resets,
      "  image: nginx:1.27.3",
      "services:",
      "  web:",
      "    image: nginx:1.27.3",
      ...uses,
      "",
    ].join("\n");

    expect(() => readComposeFile(content, "compose.yaml")).not.toThrow();
  });

  test("a merge key that merges a mapping into itself is refused", () => {
    const content = [
      "x-base: &base",
      "  nested:",
      "    <<: *base",
      "services:",
      "  web:",
      "    image: nginx:1.27.3",
      "",
    ].join("\n");

    expect(() => readComposeFile(content, "compose.yaml")).toThrow(
      "A merge key merges a mapping into itself"
    );
  });

  test("a merge through a sequence anchor back into its own mapping is refused", () => {
    const content = [
      "x-a: &a",
      "  k: &s [*a]",
      "  <<: *s",
      "services:",
      "  web:",
      "    image: nginx:1.27.3",
      "",
    ].join("\n");

    expect(() => readComposeFile(content, "compose.yaml")).toThrow(
      "A merge key merges a mapping into itself"
    );
  });

  test("a sequence that holds an alias to itself still parses", () => {
    const content = [
      "services:",
      "  web:",
      "    image: nginx:1.27.3",
      "    command: &self [echo, *self]",
      "",
    ].join("\n");

    const { document } = readComposeFile(content, "compose.yaml");

    expect(document).toMatchObject({
      services: { web: { image: "nginx:1.27.3" } },
    });
  });

  // go-yaml binds an alias to the anchor written last before it when it reads
  // the file, and compose-go drops an alias to a `!reset` value
  // (`loader/reset.go:140-144`).
  test("an alias names the last anchor before it, even on a dropped !reset value", () => {
    const content = [
      "x-a: &x {k: 1}",
      "x-b:",
      "  r: !reset &x {k: 2}",
      "services:",
      "  web:",
      "    image: nginx:1.27.3",
      "    c: *x",
      "",
    ].join("\n");

    const { document, replacedPaths } = readComposeFile(
      content,
      "compose.yaml"
    );

    expect(document).toEqual({
      services: { web: { image: "nginx:1.27.3" } },
      "x-a": { k: 1 },
      "x-b": {},
    });
    expect(replacedPaths).toContainEqual(["services", "web", "c"]);
  });

  // The bounds are loose on purpose. Resolving each alias by walking the
  // whole document took several seconds for these files, and CI runners are
  // 5 to 10 times slower than a laptop.
  test("a file with a thousand distinct aliases parses in linear time", () => {
    const content = distinctAliases(1000);
    const start = performance.now();
    const { document } = readComposeFile(content, "compose.yaml");

    expect(performance.now() - start).toBeLessThan(1000);
    expect(document).toMatchObject({
      "x-more": { m0: { A: "1" }, m999: { A: "1" } },
    });
  });

  test("the locator follows a thousand distinct aliases in linear time", () => {
    const content = distinctAliases(1000);
    const start = performance.now();
    const locate = createComposeLocator(content);

    const lines = Array.from({ length: 1000 }, (_, index) =>
      locate(["x-more", `m${index}`, "A"])
    );

    expect(performance.now() - start).toBeLessThan(1000);
    expect(lines[0]).toBe(5);
    expect(lines[999]).toBe(4001);
  });
});
