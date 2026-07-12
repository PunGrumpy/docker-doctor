import { parse } from "yaml";

import { ParseError } from "../errors";

export const parseCompose = (content: string, filepath: string): unknown => {
  try {
    return parse(content);
  } catch (error: unknown) {
    throw new ParseError({
      file: filepath,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
