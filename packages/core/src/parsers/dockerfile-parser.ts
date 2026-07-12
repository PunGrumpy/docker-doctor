import type { DockerfileInstruction } from "../types/index";

export const parseDockerfile = (content: string): DockerfileInstruction[] => {
  const instructions: DockerfileInstruction[] = [];
  const lines = content.split(/\r?\n/u);

  let currentInstruction = "";
  let currentArgs = "";
  let startLine = 0;
  let rawAccumulator: string[] = [];

  for (const [i, rawLine] of lines.entries()) {
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    // Skip empty lines or comment lines if not in multi-line block
    if (!currentInstruction && (trimmed === "" || trimmed.startsWith("#"))) {
      continue;
    }

    rawAccumulator.push(rawLine);

    let lineContent = trimmed;

    // Inside a multi-line run, comment lines are ignored by docker parser
    if (lineContent.startsWith("#")) {
      continue;
    }

    const hasContinuation = lineContent.endsWith("\\");
    if (hasContinuation) {
      lineContent = lineContent.slice(0, -1).trim();
    }

    if (currentInstruction) {
      currentArgs += (currentArgs ? " " : "") + lineContent;
    } else {
      startLine = lineNum;
      // Match the first instruction word (e.g. FROM, RUN, COPY)
      const match = lineContent.match(/^(?<inst>[A-Z]+)\s+(?<args>.*)$/iu);
      if (match?.groups) {
        currentInstruction = match.groups.inst.toUpperCase();
        currentArgs = match.groups.args;
      } else {
        const word = lineContent.trim().toUpperCase();
        if (
          ["RUN", "CMD", "ENTRYPOINT", "EXPOSE", "USER", "WORKDIR"].includes(
            word
          )
        ) {
          currentInstruction = word;
          currentArgs = "";
        }
      }
    }

    if (!hasContinuation) {
      if (currentInstruction) {
        instructions.push({
          args: currentArgs,
          instruction: currentInstruction,
          line: startLine,
          raw: rawAccumulator.join("\n"),
        });
      }
      currentInstruction = "";
      currentArgs = "";
      rawAccumulator = [];
    }
  }

  if (currentInstruction) {
    instructions.push({
      args: currentArgs,
      instruction: currentInstruction,
      line: startLine,
      raw: rawAccumulator.join("\n"),
    });
  }

  return instructions;
};
