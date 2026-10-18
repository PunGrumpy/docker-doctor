import { isComposeMapping, isComposeString } from "../parsers/compose-value";
import type { ComposeMapping, ComposeValue } from "../types/index";

// Compose casts these spellings to `true` (compose-go's `toBoolean`), so
// `privileged: "true"` and `privileged: yes` run the service privileged
// like `privileged: true` does. The YAML parser types only a bare `true`
// as a boolean.
const TRUE_SPELLINGS = new Set(["true", "y", "yes", "on"]);

export const isComposeTrue = (value: ComposeValue | undefined): boolean =>
  value === true ||
  (isComposeString(value) && TRUE_SPELLINGS.has(value.trim().toLowerCase()));

/**
 * Narrows a compose document to its service entries. A service
 * with a null body (`web:` with nothing under it) is returned as an empty
 * config so rules still check it: it is the least-configured service in
 * the file, not a service to skip. Scalar and array bodies are invalid
 * compose and are dropped. A `services:` written as a YAML sequence is
 * invalid Compose and yields no services.
 */
export const composeServices = (
  composeContent: ComposeValue
): [string, ComposeMapping][] => {
  if (!isComposeMapping(composeContent)) {
    return [];
  }

  const { services } = composeContent;

  if (!isComposeMapping(services)) {
    return [];
  }

  const entries: [string, ComposeMapping][] = [];

  for (const [name, config] of Object.entries(services)) {
    if (config === null || config === undefined) {
      entries.push([name, {}]);
    } else if (isComposeMapping(config)) {
      entries.push([name, config]);
    }
  }

  return entries;
};
