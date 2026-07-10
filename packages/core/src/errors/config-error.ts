import * as Data from "effect/Data";

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}
