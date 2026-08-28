/**
 * Narrows an unknown compose document to its service entries. Services with
 * a null/scalar body are skipped, matching the other compose rules.
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
  return Object.entries(services).filter(
    (entry): entry is [string, Record<string, unknown>] =>
      Boolean(entry[1]) && typeof entry[1] === "object"
  );
};
