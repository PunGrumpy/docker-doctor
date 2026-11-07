import type { FileIgnores, IgnoreScope } from "../types/index";

const IGNORE_KEYWORD = "docker-doctor-ignore";
const FILE_SUFFIX = "-file";
const COMMENT_MARKER = /^#\s*/u;
const REASON_MARKER = /(?:^|\s)--(?:\s|$)/u;
const NAME_SEPARATOR = /[\s,]+/u;
const STARTS_WITH_SPACE = /^\s/u;

export interface IgnoreComment {
  form: "file" | "line";
  names: string[];
  reason: string | null;
}

/**
 * Where a comment lands, decided by the file format. A comment that cannot
 * apply is refused with the reason, which becomes a warning.
 */
export type IgnorePlacement =
  | { kind: "scope"; scope: IgnoreScope }
  | { kind: "refused"; message: string };

/**
 * Reads one comment, from its leading `#` on:
 * `# docker-doctor-ignore <rule>[, <rule>...] [-- <reason>]`, or the same
 * with `docker-doctor-ignore-file`. Returns null for any other comment.
 */
export const parseIgnoreComment = (comment: string): IgnoreComment | null => {
  const trimmed = comment.trim();
  const text = trimmed.replace(COMMENT_MARKER, "");

  if (!trimmed.startsWith("#") || !text.startsWith(IGNORE_KEYWORD)) {
    return null;
  }

  const afterKeyword = text.slice(IGNORE_KEYWORD.length);
  const form = afterKeyword.startsWith(FILE_SUFFIX) ? "file" : "line";

  const rest =
    form === "file" ? afterKeyword.slice(FILE_SUFFIX.length) : afterKeyword;

  if (rest !== "" && !STARTS_WITH_SPACE.test(rest)) {
    return null;
  }

  const marker = REASON_MARKER.exec(rest);
  const namesText = marker ? rest.slice(0, marker.index) : rest;

  const reason = marker
    ? rest.slice(marker.index + marker[0].length).trim()
    : "";

  return {
    form,
    names: namesText.split(NAME_SEPARATOR).filter((name) => name !== ""),
    reason: reason === "" ? null : reason,
  };
};

/**
 * Records a comment as a directive, or as a warning when it names no rule or
 * its placement refuses it. Both readers end here.
 */
export const recordIgnore = (
  into: FileIgnores,
  comment: IgnoreComment,
  line: number,
  placement: IgnorePlacement
): void => {
  if (comment.names.length === 0) {
    const keyword =
      comment.form === "file"
        ? "docker-doctor-ignore-file"
        : "docker-doctor-ignore";

    into.warnings.push({
      line,
      message: `${keyword} names no rule, so it does nothing`,
    });
  } else if (placement.kind === "refused") {
    into.warnings.push({ line, message: placement.message });
  } else {
    into.directives.push({
      line,
      names: comment.names,
      reason: comment.reason,
      scope: placement.scope,
    });
  }
};
