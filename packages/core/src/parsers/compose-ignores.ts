import type { CST } from "yaml";
import { LineCounter, Parser } from "yaml";

import type { FileIgnores } from "../types/index";
import type { IgnoreComment, IgnorePlacement } from "./ignore-comment";
import { parseIgnoreComment, recordIgnore } from "./ignore-comment";

const LINE_BREAK = /\r?\n/u;

interface Branch {
  // Tokens that carry no value, where comments live.
  trivia: CST.SourceToken[];
  children: CST.Token[];
}

const itemBranch = (item: CST.CollectionItem): Branch => ({
  children: [item.key, item.value].filter(
    (child): child is CST.Token => child !== null && child !== undefined
  ),
  trivia: [...item.start, ...(item.sep ?? [])],
});

const mergeBranches = (branches: Branch[]): Branch => ({
  children: branches.flatMap(({ children }) => children),
  trivia: branches.flatMap(({ trivia }) => trivia),
});

const FLOW_SCALAR_TYPES: ReadonlySet<string> = new Set([
  "alias",
  "double-quoted-scalar",
  "scalar",
  "single-quoted-scalar",
]);

const branchOf = (token: CST.Token): Branch => {
  if (token.type === "document") {
    return {
      children: token.value ? [token.value] : [],
      trivia: [...token.start, ...(token.end ?? [])],
    };
  }

  if (token.type === "doc-end" || FLOW_SCALAR_TYPES.has(token.type)) {
    return { children: [], trivia: "end" in token ? (token.end ?? []) : [] };
  }

  if (token.type === "block-scalar") {
    return { children: token.props, trivia: [] };
  }

  if (token.type === "block-map" || token.type === "block-seq") {
    return mergeBranches(token.items.map(itemBranch));
  }

  if (token.type === "flow-collection") {
    const items = mergeBranches(token.items.map(itemBranch));

    return {
      children: items.children,
      trivia: [token.start, ...items.trivia, ...token.end],
    };
  }

  return { children: [], trivia: token.type === "comment" ? [token] : [] };
};

// yaml's CST keeps a comment as its own token and keeps block scalar bodies
// and quoted strings as plain source text, so a `#` inside either is never a
// comment here. The walk uses a stack because a hostile file can nest without
// limit.
const collectComments = (
  content: string,
  lineCounter: LineCounter
): CST.SourceToken[] => {
  const comments: CST.SourceToken[] = [];

  const pending = [
    ...new Parser((offset) => {
      lineCounter.addNewLine(offset);
    }).parse(content),
  ];

  for (let token = pending.pop(); token; token = pending.pop()) {
    const { children, trivia } = branchOf(token);

    comments.push(...trivia.filter(({ type }) => type === "comment"));
    pending.push(...children);
  }

  return comments.toSorted((a, b) => a.offset - b.offset);
};

interface LocatedComment {
  line: number;
  source: string;
  // True when other text comes before the comment on its line.
  trailing: boolean;
}

const locateComments = (
  content: string,
  lineCounter: LineCounter,
  comments: CST.SourceToken[]
): LocatedComment[] =>
  comments.map(({ offset, source }) => {
    const { line } = lineCounter.linePos(offset);
    const lineStart = lineCounter.lineStarts[line - 1] ?? 0;

    return {
      line,
      source,
      trailing: content.slice(lineStart, offset).trim() !== "",
    };
  });

interface LineMap {
  // The first line below line n that holds content, at index n.
  contentAfter: (number | undefined)[];
  // The first line that holds content.
  firstContent: number;
}

const mapContentLines = (
  lines: string[],
  commentOnlyLines: Set<number>
): LineMap => {
  const contentAfter: (number | undefined)[] = [];
  let firstContent = lines.length + 1;
  let below: number | undefined;

  for (let line = lines.length; line >= 1; line -= 1) {
    contentAfter[line] = below;

    if ((lines[line - 1] ?? "").trim() !== "" && !commentOnlyLines.has(line)) {
      below = line;
      firstContent = line;
    }
  }

  return { contentAfter, firstContent };
};

const placeComment = (
  comment: IgnoreComment,
  { line, trailing }: LocatedComment,
  { contentAfter, firstContent }: LineMap
): IgnorePlacement => {
  if (comment.form === "file") {
    return !trailing && line < firstContent
      ? { kind: "scope", scope: { kind: "file" } }
      : {
          kind: "refused",
          message:
            "docker-doctor-ignore-file is only honored in the comment block at the top of the file",
        };
  }

  const target = trailing ? line : contentAfter[line];

  return target === undefined
    ? {
        kind: "refused",
        message: "no line follows this ignore comment, so it does nothing",
      }
    : { kind: "scope", scope: { kind: "line", line: target } };
};

/**
 * Reads the ignore comments of one Compose file from its YAML comments.
 */
export const readComposeIgnores = (content: string): FileIgnores => {
  const lineCounter = new LineCounter();

  const located = locateComments(
    content,
    lineCounter,
    collectComments(content, lineCounter)
  );

  const commentOnlyLines = new Set<number>();

  for (const { line, trailing } of located) {
    if (!trailing) {
      commentOnlyLines.add(line);
    }
  }

  const lineMap = mapContentLines(content.split(LINE_BREAK), commentOnlyLines);
  const ignores: FileIgnores = { directives: [], warnings: [] };

  for (const site of located) {
    const comment = parseIgnoreComment(site.source);

    if (comment !== null) {
      recordIgnore(
        ignores,
        comment,
        site.line,
        placeComment(comment, site, lineMap)
      );
    }
  }

  return ignores;
};
