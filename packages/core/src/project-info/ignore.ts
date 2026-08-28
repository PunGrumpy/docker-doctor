const GLOB_SPECIALS_RE = /[.+^${}()|[\]\\]/gu;

/**
 * Compiles one glob pattern from `ignore.files` to a RegExp over
 * POSIX-style relative paths. Supported syntax is the subset the docs
 * promise: `**` crosses directory separators (`**` followed by `/` matches
 * zero or more whole segments), `*` and `?` stay within one segment.
 * Brace expansion and character classes are not supported.
 */
const globToRegExp = (pattern: string): RegExp => {
  let source = "^";
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:[^/]*/)*";
          index += 3;
        } else {
          source += ".*";
          index += 2;
        }
      } else {
        source += "[^/]*";
        index += 1;
      }
    } else if (char === "?") {
      source += "[^/]";
      index += 1;
    } else {
      source += char.replace(GLOB_SPECIALS_RE, String.raw`\$&`);
      index += 1;
    }
  }
  return new RegExp(`${source}$`, "u");
};

/**
 * Builds a predicate over root-relative paths from `ignore.files`
 * patterns. Windows separators in the tested path are normalized to `/`
 * before matching, so patterns are always written POSIX-style.
 */
export const createIgnoreMatcher = (
  patterns?: readonly string[]
): ((relativePath: string) => boolean) => {
  if (!patterns || patterns.length === 0) {
    return () => false;
  }
  const regexps = patterns.map(globToRegExp);
  return (relativePath) => {
    const normalized = relativePath.replaceAll("\\", "/");
    return regexps.some((regexp) => regexp.test(normalized));
  };
};
