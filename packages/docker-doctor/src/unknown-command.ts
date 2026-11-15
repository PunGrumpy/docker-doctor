import { closestMatch } from "@docker-doctor/core";

const HELP_FLAG = "--help";

// Words people type as a command that docker-doctor does not have. The value
// is what to type instead, or null when nothing maps onto it.
const NON_COMMANDS: ReadonlyMap<string, string | null> = new Map([
  ["check", null],
  ["config", null],
  ["explain", "rules explain"],
  ["fix", null],
  ["help", HELP_FLAG],
  ["init", null],
  ["lint", null],
  ["list", "rules list"],
  ["run", null],
  ["scan", null],
  ["setup", null],
  ["version", "--version"],
]);

const PATH_SYNTAX = /[\\/]|^[.~-]/u;

// The positional argument is a directory to scan, so a mistyped command lands
// there and fails as "Directory not found". Called only for a path that does
// not exist, it recognizes a bare word that is a misspelled command or a
// common command docker-doctor lacks, and returns the message to print.
// Returns null for anything that reads as a path.
export const describeUnknownCommand = (
  word: string,
  commandNames: readonly string[]
): string | null => {
  if (PATH_SYNTAX.test(word)) {
    return null;
  }

  const redirect = NON_COMMANDS.get(word.toLowerCase());
  const suggestion = redirect ?? closestMatch(word, commandNames);

  if (suggestion === undefined && redirect === undefined) {
    return null;
  }

  const hint =
    suggestion === undefined
      ? ""
      : ` Did you mean "docker-doctor ${suggestion}"?`;

  // The suggestion already is the pointer to --help.
  const pointer =
    suggestion === HELP_FLAG
      ? ""
      : " Run docker-doctor --help to see the commands.";

  return `Unknown command "${word}", and no directory has that name.${hint}${pointer}`;
};
