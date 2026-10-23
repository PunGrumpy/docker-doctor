import type { ComposeMapping, ComposeValue } from "../types/index";

type ComposeEntry = ComposeValue | undefined;

export const isComposeString = (value: ComposeEntry): value is string =>
  typeof value === "string";

export const isComposeNumber = (value: ComposeEntry): value is number =>
  typeof value === "number";

export const isComposeSequence = (
  value: ComposeEntry
): value is readonly ComposeValue[] => Array.isArray(value);

export const isComposeMapping = (
  value: ComposeEntry
): value is ComposeMapping =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const composeField = (value: ComposeEntry, key: string): ComposeEntry =>
  isComposeMapping(value) ? value[key] : undefined;

const isComposeTree = (
  value: unknown,
  seen: WeakSet<object>
): value is ComposeValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value !== "object") {
    return false;
  }

  // An alias can point back at its own anchor.
  if (seen.has(value)) {
    return true;
  }

  seen.add(value);

  return Object.values(value).every((child) => isComposeTree(child, seen));
};

export const isComposeValue = (value: unknown): value is ComposeValue =>
  isComposeTree(value, new WeakSet());
