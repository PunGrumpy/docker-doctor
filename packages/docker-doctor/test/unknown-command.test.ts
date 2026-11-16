import { describe, expect, test } from "bun:test";

import { describeUnknownCommand } from "../src/unknown-command";

const COMMANDS = ["install", "rules"];

describe("describeUnknownCommand", () => {
  test("suggests the command a typo is closest to", () => {
    expect(describeUnknownCommand("instal", COMMANDS)).toBe(
      'Unknown command "instal", and no directory has that name. Did you mean "docker-doctor install"? Run docker-doctor --help to see the commands.'
    );
    expect(describeUnknownCommand("rule", COMMANDS)).toContain(
      'Did you mean "docker-doctor rules"?'
    );
  });

  test.each([
    ["help", "docker-doctor --help"],
    ["list", "docker-doctor rules list"],
    ["explain", "docker-doctor rules explain"],
  ])("points %s at %s", (word, suggestion) => {
    expect(describeUnknownCommand(word, COMMANDS)).toContain(
      `Did you mean "${suggestion}"?`
    );
  });

  test("does not repeat --help when the suggestion is --help", () => {
    expect(describeUnknownCommand("help", COMMANDS)).toBe(
      'Unknown command "help", and no directory has that name. Did you mean "docker-doctor --help"?'
    );
  });

  test("reports a common non-command that has no replacement", () => {
    const message = describeUnknownCommand("init", COMMANDS);

    expect(message).toContain('Unknown command "init"');
    expect(message).not.toContain("Did you mean");
    expect(message).toContain("--help");
  });

  test("leaves an ordinary directory name alone", () => {
    expect(describeUnknownCommand("services", COMMANDS)).toBeNull();
  });

  test.each(["./init", "../init", "sub/init", "C:\\init", "~/init", "-init"])(
    "leaves the path %s alone",
    (word) => {
      expect(describeUnknownCommand(word, COMMANDS)).toBeNull();
    }
  );
});
