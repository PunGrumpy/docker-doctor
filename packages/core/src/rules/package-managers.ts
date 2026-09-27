// `apt-get -y --no-install-recommends install curl` is as common as
// `apt-get install -y curl`, so options may sit between the command and the
// subcommand. Known limitation: an option value written as a separate word
// (`-o Key=Value`) does not start with `-` and breaks the match.
const APT_GET_INSTALL_RE = /\bapt-get(?:\s+-\S+)*\s+install\b/u;
const APT_GET_UPDATE_RE = /\bapt-get(?:\s+-\S+)*\s+update\b/u;

export const hasAptGetInstall = (text: string): boolean =>
  APT_GET_INSTALL_RE.test(text);

export const hasAptGetUpdate = (text: string): boolean =>
  APT_GET_UPDATE_RE.test(text);
