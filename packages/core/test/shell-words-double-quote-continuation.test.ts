import { describe, expect, test } from "bun:test";

import { splitShellWords } from "../src/parsers/shell-words";

describe("splitShellWords backslash-newline inside quotes", () => {
  test("vanishes inside double quotes", () => {
    expect(splitShellWords('echo "a\\\nb"')).toEqual(["echo", "ab"]);
  });

  test("vanishes inside double quotes with CRLF", () => {
    expect(splitShellWords('echo "a\\\r\nb"')).toEqual(["echo", "ab"]);
  });

  test("an escaped backslash before the newline is not a continuation", () => {
    expect(splitShellWords('echo "a\\\\\nb"')).toEqual(["echo", "a\\\nb"]);
  });

  test("stays literal inside single quotes", () => {
    expect(splitShellWords("echo 'a\\\nb'")).toEqual(["echo", "a\\\nb"]);
  });

  test("a lone backslash before other characters stays", () => {
    expect(splitShellWords('echo "a\\nb"')).toEqual(["echo", "a\\nb"]);
  });
});
