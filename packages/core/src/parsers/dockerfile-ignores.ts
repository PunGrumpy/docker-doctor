import type { DockerfileInstruction, FileIgnores } from "../types/index";
import { matchParserDirective, stripLeadingBom } from "./dockerfile-directives";
import type { IgnoreComment, IgnorePlacement } from "./ignore-comment";
import { parseIgnoreComment, recordIgnore } from "./ignore-comment";

const LINE_BREAK = /\r?\n/u;

interface SpanIndex {
  // Line number (1-based) of the last line of each instruction.
  ends: number[];
  // Indexes (0-based) of the lines the parser kept inside an instruction.
  consumed: Set<number>;
}

const indexOfLine = (
  lines: string[],
  text: string,
  from: number,
  until: number
): number => {
  for (let index = from; index < until; index += 1) {
    if (lines[index] === text) {
      return index;
    }
  }

  return -1;
};

// The parser drops comment and blank lines that sit inside a multi-line
// instruction, and keeps every other line of the instruction in `raw`. Walking
// the file against `raw` therefore finds the real end of each instruction and
// tells a heredoc body line from a comment.
const locateSpans = (
  lines: string[],
  instructions: DockerfileInstruction[]
): SpanIndex => {
  const consumed = new Set<number>();
  const ends: number[] = [];

  for (const [position, instruction] of instructions.entries()) {
    const until = (instructions[position + 1]?.line ?? lines.length + 1) - 1;
    let cursor = instruction.line - 1;
    let end = instruction.line;

    for (const rawLine of instruction.raw.split("\n")) {
      const found = indexOfLine(lines, rawLine, cursor, until);

      if (found === -1) {
        break;
      }

      consumed.add(found);
      cursor = found + 1;
      end = found + 1;
    }

    ends.push(end);
  }

  return { consumed, ends };
};

// A comment above a parser directive would end BuildKit's directive block, so
// the directive below it would stop working. This is the last line of the top
// run of parser directives and ignore comments that holds a parser directive.
const lastParserDirectiveLine = (lines: string[]): number => {
  const body = [stripLeadingBom(lines[0] ?? ""), ...lines.slice(1)];
  const first = body[0]?.startsWith("#!") ? 1 : 0;
  let last = 0;

  for (let index = first; index < body.length; index += 1) {
    const line = body[index] ?? "";

    if (matchParserDirective(line)) {
      last = index + 1;
    } else if (parseIgnoreComment(line) === null) {
      break;
    }
  }

  return last;
};

interface CommentSite {
  line: number;
  // The instruction that starts after the comment, if any.
  following: DockerfileInstruction | undefined;
  // True when the comment sits inside a multi-line instruction.
  insideInstruction: boolean;
  // True when no instruction starts before the comment.
  leading: boolean;
}

const placeComment = (
  comment: IgnoreComment,
  site: CommentSite,
  directiveBlockEnd: number
): IgnorePlacement => {
  if (site.insideInstruction) {
    return {
      kind: "refused",
      message:
        "ignore comment sits inside a multi-line instruction, so it does nothing. Move it above the instruction",
    };
  }

  if (site.line < directiveBlockEnd) {
    return {
      kind: "refused",
      message:
        "ignore comment sits above a parser directive such as `# syntax=`, which would end BuildKit's directive block, so it does nothing. Move it below the parser directives",
    };
  }

  if (comment.form === "file") {
    return site.leading
      ? { kind: "scope", scope: { kind: "file" } }
      : {
          kind: "refused",
          message:
            "docker-doctor-ignore-file is only honored in the comment block at the top of the Dockerfile",
        };
  }

  return site.following
    ? { kind: "scope", scope: { kind: "line", line: site.following.line } }
    : {
        kind: "refused",
        message:
          "no instruction follows this ignore comment, so it does nothing",
      };
};

/**
 * Reads the ignore comments of one Dockerfile. `instructions` is the parse of
 * the same `content`. The parser itself is not involved. Heredoc bodies and
 * comments inside a multi-line instruction come from its output.
 */
export const readDockerfileIgnores = (
  content: string,
  instructions: DockerfileInstruction[]
): FileIgnores => {
  const lines = content.split(LINE_BREAK);
  const { consumed, ends } = locateSpans(lines, instructions);
  const directiveBlockEnd = lastParserDirectiveLine(lines);
  const ignores: FileIgnores = { directives: [], warnings: [] };
  let next = 0;

  for (const [index, line] of lines.entries()) {
    const comment = consumed.has(index) ? null : parseIgnoreComment(line);

    if (comment !== null) {
      const lineNumber = index + 1;

      while (
        next < instructions.length &&
        (instructions[next]?.line ?? 0) < lineNumber
      ) {
        next += 1;
      }

      const previousEnd = ends[next - 1];

      const site: CommentSite = {
        following: instructions[next],
        insideInstruction:
          previousEnd !== undefined && lineNumber < previousEnd,
        leading: next === 0,
        line: lineNumber,
      };

      recordIgnore(
        ignores,
        comment,
        lineNumber,
        placeComment(comment, site, directiveBlockEnd)
      );
    }
  }

  return ignores;
};
