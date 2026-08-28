/**
 * Narrows an unknown compose document to its service entries. A service
 * with a null body (`web:` with nothing under it) is returned as an empty
 * config so rules still check it: it is the least-configured service in
 * the file, not a service to skip. Scalar and array bodies are invalid
 * compose and are dropped.
 */
export const composeServices = (
  composeContent: unknown
): [string, Record<string, unknown>][] => {
  if (
    !composeContent ||
    typeof composeContent !== "object" ||
    !("services" in composeContent)
  ) {
    return [];
  }
  const { services } = composeContent as { services?: unknown };
  if (!services || typeof services !== "object") {
    return [];
  }

  const entries: [string, Record<string, unknown>][] = [];
  for (const [name, config] of Object.entries(services)) {
    if (config === null || config === undefined) {
      entries.push([name, {}]);
    } else if (typeof config === "object" && !Array.isArray(config)) {
      entries.push([name, config as Record<string, unknown>]);
    }
  }
  return entries;
};
