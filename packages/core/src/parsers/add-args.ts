import { parseExecForm } from "./exec-form";
import { splitShellWords } from "./shell-words";

const LEADING_FLAGS_RE = /^(?:--\S+\s+)*/u;
const CHECKSUM_FLAG_RE = /(?:^|\s)--checksum=/u;

export interface AddArgs {
  /** BuildKit verifies a download when ADD has `--checksum=`. */
  hasChecksum: boolean;
  /** The first source, as BuildKit reads it once quotes are removed. */
  source: string | undefined;
}

/**
 * Splits the arguments of ADD into its checksum flag and its first source. BuildKit
 * passes each source through `shlex.ProcessWord` before it uses it
 * (`dispatch` in frontend/dockerfile/dockerfile2llb/convert.go calls
 * `SourcesAndDest.Expand` in frontend/dockerfile/instructions/commands.go),
 * so `ADD "https://x/y" /d` downloads the URL. The JSON array form
 * `ADD ["https://x/y", "/d"]` lists the same sources as strings.
 */
export const parseAddArgs = (args: string): AddArgs => {
  const flagText = LEADING_FLAGS_RE.exec(args)?.[0] ?? "";
  const rest = args.slice(flagText.length).trim();
  const elements = parseExecForm(rest);

  return {
    hasChecksum: CHECKSUM_FLAG_RE.test(flagText),
    source: elements === null ? splitShellWords(rest).at(0) : elements.at(0),
  };
};
