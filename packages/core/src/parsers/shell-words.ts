import { maskQuotedText } from "./shell-quotes";

const COMMAND_BOUNDARY_CHARS = new Set([";", "&", "|", "(", ")", "`"]);
const DOUBLE_QUOTE_ESCAPES = new Set(['"', "$", "`", "\\"]);
const WHITESPACE_CHAR_RE = /\s/u;

// The length of the backslash-newline at `index`, or 0 when there is none.
const continuationLength = (text: string, index: number): number => {
  if (text[index] !== "\\") {
    return 0;
  }

  if (text[index + 1] === "\n") {
    return 2;
  }

  return text[index + 1] === "\r" && text[index + 2] === "\n" ? 3 : 0;
};

/**
 * Splits shell text into the simple commands it runs, cutting at the
 * separators `;`, `&`, `|`, `(`, `)`, a backtick and a newline that no
 * backslash continues. Separators inside quotes do not cut. It does not
 * understand heredoc bodies, `case` patterns or `$(( ))`. The lines of a
 * heredoc body split into commands only while the text keeps its line breaks,
 * as an instruction's `raw` does and its `args` does not.
 */
export const splitShellCommands = (text: string): string[] => {
  const masked = maskQuotedText(text);
  const commands: string[] = [];
  let start = 0;

  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index];
    const before = masked[index - 1] === "\r" ? index - 2 : index - 1;
    const isNewline = char === "\n" && masked[before] !== "\\";

    if (isNewline || COMMAND_BOUNDARY_CHARS.has(char)) {
      commands.push(text.slice(start, index));
      start = index + 1;
    }
  }

  commands.push(text.slice(start));

  return commands;
};

interface QuotedSpan {
  end: number;
  value: string;
}

// The text inside the quote that opens just before `start`, and the index
// after the closing quote. Single quotes take everything literally. In double
// quotes a backslash escapes only `"`, `$`, a backtick and `\`.
const readQuoted = (text: string, start: number, quote: string): QuotedSpan => {
  let value = "";
  let index = start;

  while (index < text.length && text[index] !== quote) {
    const escaped = text[index + 1];

    if (
      quote === '"' &&
      text[index] === "\\" &&
      DOUBLE_QUOTE_ESCAPES.has(escaped)
    ) {
      value += escaped;
      index += 2;
    } else {
      value += text[index];
      index += 1;
    }
  }

  return { end: index + 1, value };
};

/**
 * Splits one simple command into its words the way a POSIX shell does before
 * expansion. Quotes are removed, a backslash escapes the next character, a
 * backslash-newline vanishes, and a `#` that starts a word ends the command.
 * `$VAR` stays in the word as written.
 */
export const splitShellWords = (command: string): string[] => {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  let index = 0;

  const endWord = (): void => {
    if (inWord) {
      words.push(word);
    }

    word = "";
    inWord = false;
  };

  while (index < command.length) {
    const char = command[index];
    const continuation = continuationLength(command, index);

    if (char === "'" || char === '"') {
      const quoted = readQuoted(command, index + 1, char);
      word += quoted.value;
      inWord = true;
      index = quoted.end;
    } else if (continuation > 0) {
      index += continuation;
    } else if (char === "\\" && index + 1 < command.length) {
      word += command[index + 1];
      inWord = true;
      index += 2;
    } else if (WHITESPACE_CHAR_RE.test(char)) {
      endWord();
      index += 1;
    } else if (char === "#" && !inWord) {
      break;
    } else {
      word += char;
      inWord = true;
      index += 1;
    }
  }

  endWord();

  return words;
};
