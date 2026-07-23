export class FileNotFoundError extends Error {
  readonly _tag = "FileNotFoundError" as const;
  readonly path: string;

  constructor(options: { readonly path: string }) {
    super(`File not found: ${options.path}`);
    this.name = "FileNotFoundError";
    this.path = options.path;
  }
}
