import * as Data from "effect/Data";

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly file: string;
  readonly message: string;
}> {}
