export class ConfigError extends Error {
  readonly _tag = "ConfigError" as const;

  constructor(options: { readonly message: string }) {
    super(options.message);
    this.name = "ConfigError";
  }
}
