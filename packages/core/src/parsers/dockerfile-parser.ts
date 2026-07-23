import type { DockerfileInstruction } from "../types/index";

const DOCKERFILE_KEYWORDS = new Set([
  "ADD",
  "ARG",
  "CMD",
  "COPY",
  "ENTRYPOINT",
  "ENV",
  "EXPOSE",
  "FROM",
  "HEALTHCHECK",
  "LABEL",
  "MAINTAINER",
  "ONBUILD",
  "RUN",
  "SHELL",
  "STOPSIGNAL",
  "USER",
  "VOLUME",
  "WORKDIR",
]);

const INSTRUCTION_LINE_RE = /^(?<inst>[A-Za-z]+)\s+(?<args>.*)$/u;

// Matches a heredoc opener like <<EOF, <<-EOF, <<'EOF', <<"EOF". Global so a
// single line (e.g. `COPY <<FILE1 <<FILE2 /dest/`) can open more than one.
const HEREDOC_OPENER_RE = /<<-?\s*(?<quote>['"]?)(?<delim>\w+)\k<quote>/gu;

interface ParserState {
  instructions: DockerfileInstruction[];
  currentInstruction: string;
  currentArgs: string;
  startLine: number;
  rawAccumulator: string[];
  // FIFO of heredoc delimiters still open for the current instruction, in
  // the order they were opened (closed in the same order).
  heredocQueue: string[];
}

const createParserState = (): ParserState => ({
  currentArgs: "",
  currentInstruction: "",
  heredocQueue: [],
  instructions: [],
  rawAccumulator: [],
  startLine: 0,
});

const closeInstruction = (state: ParserState): void => {
  if (state.currentInstruction) {
    state.instructions.push({
      args: state.currentArgs,
      instruction: state.currentInstruction,
      line: state.startLine,
      raw: state.rawAccumulator.join("\n"),
    });
  }
  state.currentInstruction = "";
  state.currentArgs = "";
  state.rawAccumulator = [];
};

const matchInstructionKeyword = (
  lineContent: string
): { instruction: string; args: string } | null => {
  const match = lineContent.match(INSTRUCTION_LINE_RE);
  const matchedWord = match?.groups?.inst.toUpperCase();
  if (matchedWord && DOCKERFILE_KEYWORDS.has(matchedWord)) {
    return { args: match?.groups?.args ?? "", instruction: matchedWord };
  }

  const word = lineContent.trim().toUpperCase();
  if (DOCKERFILE_KEYWORDS.has(word)) {
    return { args: "", instruction: word };
  }

  return null;
};

const findHeredocDelimiters = (lineContent: string): string[] =>
  [...lineContent.matchAll(HEREDOC_OPENER_RE)].map(
    (m) => m.groups?.delim ?? ""
  );

// Heredoc body lines are never treated as instructions (not even comment
// lines, which are shell-comment content here) — they are folded verbatim
// into the owning instruction's args until the delimiter line closes the
// (possibly multiple) open heredoc(s), in the order they were opened.
const processHeredocLine = (state: ParserState, trimmed: string): void => {
  if (trimmed === state.heredocQueue[0]) {
    state.heredocQueue.shift();
  } else {
    state.currentArgs += (state.currentArgs ? " " : "") + trimmed;
  }

  if (state.heredocQueue.length === 0) {
    // Last open heredoc just closed: the instruction ends here.
    closeInstruction(state);
  }
};

const processInstructionLine = (
  state: ParserState,
  trimmed: string,
  lineNum: number
): void => {
  let lineContent = trimmed;

  // Inside a multi-line run, comment lines are ignored by docker parser
  if (lineContent.startsWith("#")) {
    return;
  }

  const hasContinuation = lineContent.endsWith("\\");
  if (hasContinuation) {
    lineContent = lineContent.slice(0, -1).trim();
  }

  if (state.currentInstruction) {
    state.currentArgs += (state.currentArgs ? " " : "") + lineContent;
  } else {
    state.startLine = lineNum;
    // Match the first instruction word (e.g. FROM, RUN, COPY)
    const matched = matchInstructionKeyword(lineContent);
    if (matched) {
      state.currentInstruction = matched.instruction;
      state.currentArgs = matched.args;
    }
  }

  if (state.currentInstruction) {
    state.heredocQueue.push(...findHeredocDelimiters(lineContent));
  }

  if (state.heredocQueue.length > 0) {
    // A heredoc opener implies continuation even without a trailing
    // backslash — keep accumulating until every opened delimiter closes.
    return;
  }

  if (!hasContinuation) {
    closeInstruction(state);
  }
};

export const parseDockerfile = (content: string): DockerfileInstruction[] => {
  const state = createParserState();
  const lines = content.split(/\r?\n/u);

  for (const [i, rawLine] of lines.entries()) {
    const trimmed = rawLine.trim();
    const lineNum = i + 1;
    const insideHeredoc = state.heredocQueue.length > 0;

    // Skip empty lines or comment lines if not in multi-line block
    if (
      !state.currentInstruction &&
      !insideHeredoc &&
      (trimmed === "" || trimmed.startsWith("#"))
    ) {
      continue;
    }

    state.rawAccumulator.push(rawLine);

    if (insideHeredoc) {
      processHeredocLine(state, trimmed);
    } else {
      processInstructionLine(state, trimmed, lineNum);
    }
  }

  // EOF: an unterminated heredoc (or a trailing backslash continuation)
  // still emits whatever was accumulated so far, rather than dropping it.
  closeInstruction(state);

  return state.instructions;
};
