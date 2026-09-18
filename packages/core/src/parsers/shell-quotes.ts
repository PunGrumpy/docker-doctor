/**
 * Replaces every character inside a single- or double-quoted region with a
 * space, keeping the quotes themselves and the string length, so callers can
 * run position-sensitive regexes over shell text without matching inside
 * string literals. A backslash inside double quotes escapes the next
 * character; single quotes have no escapes (POSIX sh). An unclosed quote
 * masks to the end of the text.
 *
 * What this deliberately does NOT do: it is not a tokenizer. It performs no
 * variable or command expansion, knows nothing about subshells, backslash
 * line continuations, `$'...'` or `<<` heredoc bodies, and does not split
 * words. It only blanks quoted spans so regexes keep their positions.
 */
export const maskQuotedText = (text: string): string => {
  let out = "";
  let quote: '"' | "'" | null = null;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (quote === null) {
      if (char === '"' || char === "'") {
        quote = char;
      }
      out += char;
      index += 1;
      continue;
    }
    if (char === quote) {
      quote = null;
      out += char;
      index += 1;
      continue;
    }
    if (quote === '"' && char === "\\" && index + 1 < text.length) {
      out += "  ";
      index += 2;
      continue;
    }
    out += " ";
    index += 1;
  }
  return out;
};
