import { parse } from "yaml";

import { ParseError } from "../errors";

export const parseCompose = (content: string, filepath: string): unknown => {
  try {
    // Compose files rely on YAML 1.1 merge keys (`<<: *anchor`); yaml's
    // default 1.2 schema leaves `<<` as a literal key without this option.
    return parse(content, { merge: true });
  } catch (error: unknown) {
    throw new ParseError({
      file: filepath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
