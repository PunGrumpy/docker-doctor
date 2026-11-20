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

// The same match for `apt` as well as `apt-get`. The name is followed by
// whitespace, so apt-cache, apt-key and a name like my-apt never match.
const APT_INSTALL_RE = /(?<![\w-])apt(?:-get)?(?:\s+-\S+)*\s+install(?![\w-])/u;
const APT_UPDATE_RE = /(?<![\w-])apt(?:-get)?(?:\s+-\S+)*\s+update(?![\w-])/u;

export const hasAptInstall = (text: string): boolean =>
  APT_INSTALL_RE.test(text);

export const hasAptUpdate = (text: string): boolean => APT_UPDATE_RE.test(text);
