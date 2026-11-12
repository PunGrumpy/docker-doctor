import { describe, expect, test } from "bun:test";

import { splitShellCommands } from "../src/parsers/shell-words";

describe("splitShellCommands", () => {
  test("a backslash before a newline continues the command", () => {
    expect(splitShellCommands("echo a \\\nb")).toEqual(["echo a \\\nb"]);
  });

  test("a backslash before a CRLF continues the command", () => {
    expect(splitShellCommands("echo a \\\r\nb")).toEqual(["echo a \\\r\nb"]);
  });

  test("an escaped backslash before a newline ends the command", () => {
    expect(splitShellCommands("echo a\\\\\nrm -rf x")).toEqual([
      "echo a\\\\",
      "rm -rf x",
    ]);
  });

  test("an escaped backslash before a CRLF ends the command", () => {
    expect(splitShellCommands("echo a\\\\\r\nrm -rf x")).toEqual([
      "echo a\\\\\r",
      "rm -rf x",
    ]);
  });

  test("three backslashes before a newline still continue the command", () => {
    expect(splitShellCommands("echo a\\\\\\\nb")).toEqual(["echo a\\\\\\\nb"]);
  });
});
