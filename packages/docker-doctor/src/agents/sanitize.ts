// Everything an agent reads from a scan is derived from the scanned repo:
// rule messages quote Dockerfile lines verbatim, and file paths come from
// whatever the repo happens to contain. Both are flattened to a single line
// and length-capped before they reach a prompt or an on-disk report, so no
// scanned content can introduce its own line into an agent's instructions.
// oxlint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]+/gu;

const MAX_MESSAGE_LENGTH = 300;
const MAX_PATH_LENGTH = 200;

const flatten = (value: string, maxLength: number): string => {
  const flat = value.replaceAll(CONTROL_CHARS_RE, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength)}…` : flat;
};

export const sanitizeMessage = (message: string): string =>
  flatten(message, MAX_MESSAGE_LENGTH);

// Paths are attacker-controlled in the same way messages are -- a filename
// may legally contain newlines and ANSI escapes on every platform we run on.
export const sanitizePath = (filePath: string): string =>
  flatten(filePath, MAX_PATH_LENGTH);
