// BuildKit options on RUN (`--mount=...`, `--network=...`, `--security=...`,
// `--device=...`) come between the keyword and the command. A rule that
// looks for a command at the start of the instruction must not see them.
const LEADING_RUN_FLAGS_RE = /^(?:--[a-z][a-z-]*(?:=\S*)?\s+)+/u;

export const stripRunFlags = (args: string): string =>
  args.replace(LEADING_RUN_FLAGS_RE, "");
