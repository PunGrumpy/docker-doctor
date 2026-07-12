import type { ConfigError } from "./errors/config-error";
import type { FileNotFoundError } from "./errors/file-not-found-error";
import type { ParseError } from "./errors/parse-error";

export { ConfigError } from "./errors/config-error";
export { FileNotFoundError } from "./errors/file-not-found-error";
export { ParseError } from "./errors/parse-error";

export type DockerDoctorError = ParseError | FileNotFoundError | ConfigError;
