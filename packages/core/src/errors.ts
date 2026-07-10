import type { ConfigError } from "./errors/config-error.js";
import type { FileNotFoundError } from "./errors/file-not-found-error.js";
import type { ParseError } from "./errors/parse-error.js";

export { ConfigError } from "./errors/config-error.js";
export { FileNotFoundError } from "./errors/file-not-found-error.js";
export { ParseError } from "./errors/parse-error.js";

export type DockerDoctorError = ParseError | FileNotFoundError | ConfigError;
