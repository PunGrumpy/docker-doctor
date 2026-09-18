import { describe, test, expect } from "bun:test";

import { maskQuotedText } from "../src/parsers/shell-quotes";

const CASES: { input: string; expected: string; name: string }[] = [
  {
    expected: 'grep -E "       " f',
    input: 'grep -E "foo|bar" f',
    name: "masks a pipe inside double quotes",
  },
  {
    expected: "echo '   ' | wc",
    input: "echo 'a|b' | wc",
    name: "masks single-quoted text and leaves the real pipe",
  },
  {
    expected: 'echo "               " | cat',
    input: 'echo "say \\"hi|\\" now" | cat',
    name: "treats a backslash-escaped quote as part of the quoted region",
  },
  {
    expected: "mkdir /opt/cd",
    input: "mkdir /opt/cd",
    name: "leaves unquoted text untouched",
  },
  {
    expected: 'echo "            ',
    input: 'echo "unclosed | x',
    name: "masks an unclosed quote to the end of the text",
  },
  {
    expected: '""',
    input: '""',
    name: "keeps an empty quoted region",
  },
];

describe("maskQuotedText", () => {
  for (const { input, expected, name } of CASES) {
    test(name, () => {
      expect(maskQuotedText(input)).toBe(expected);
    });
  }

  test("preserves the length of every input", () => {
    for (const { input } of CASES) {
      expect(maskQuotedText(input).length).toBe(input.length);
    }
  });
});
