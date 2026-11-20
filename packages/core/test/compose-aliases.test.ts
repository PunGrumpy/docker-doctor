import { describe, expect, test } from "bun:test";

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

describe("Compose aliases", () => {
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
