export class ParseError extends Error {
  readonly _tag = "ParseError" as const;
  readonly file: string;

  constructor(options: { readonly file: string; readonly message: string }) {
    super(options.message);
    this.name = "ParseError";
    this.file = options.file;
  }
}
