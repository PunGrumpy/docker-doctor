// Everything an agent reads from a scan comes from the scanned repo. Rule
// messages quote Dockerfile lines, and file paths come from whatever the
// repo contains. Both are flattened to one line and length-capped before
// they reach a prompt or an on-disk report. So no scanned content can add
// its own line to an agent's instructions.
//
// Flattening also replaces characters a reader cannot see. These are C0
// and C1 controls (Cc, which includes NEL), format characters (Cf), and the
// line and paragraph separators (Zl, Zp). Cf covers zero-width characters,
// bidi embeddings, overrides and isolates, the BOM and the assigned tag
// characters. The unassigned tag code points are listed explicitly.
// scripts/render-github-action-comment.mjs keeps the same class in
// INVISIBLE_CHARS_RE. Its test checks that both strip the same samples.
const INVISIBLE_CHARS_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}]+/gu;

const MAX_MESSAGE_LENGTH = 300;
const MAX_PATH_LENGTH = 200;

const flatten = (value: string, maxLength: number): string => {
  const flat = value.replaceAll(INVISIBLE_CHARS_RE, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength)}…` : flat;
};

export const sanitizeMessage = (message: string): string =>
  flatten(message, MAX_MESSAGE_LENGTH);

// Paths are attacker-controlled in the same way messages are -- a filename
// may legally contain newlines and ANSI escapes on every platform we run on.
export const sanitizePath = (filePath: string): string =>
  flatten(filePath, MAX_PATH_LENGTH);
