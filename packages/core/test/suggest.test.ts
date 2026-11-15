import { describe, expect, test } from "bun:test";

import { closestMatch } from "../src/suggest";

describe("closestMatch", () => {
  const keys = ["$schema", "categories", "ignore", "rules"];

  test("finds a key one edit away", () => {
    expect(closestMatch("rule", keys)).toBe("rules");
  });

  test("finds a key two edits away", () => {
    expect(closestMatch("rulez!", keys)).toBe("rules");
  });

  test("ignores case", () => {
    expect(closestMatch("RULES", keys)).toBe("rules");
  });

  test("returns the closest candidate, not the first within range", () => {
    expect(closestMatch("abc", ["abxx", "abx"])).toBe("abx");
  });

  test("returns undefined when nothing is within two edits", () => {
    expect(closestMatch("foo", keys)).toBeUndefined();
  });
});
