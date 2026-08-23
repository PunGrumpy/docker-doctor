import { allRules } from "../rules/index";
import type { RuleCategory } from "../types/index";

const KNOWN_CATEGORIES: readonly RuleCategory[] = [
  "Best Practices",
  "Compose",
  "Image Size",
  "Performance",
  "Security",
];

export interface UnknownConfigKeys {
  categories: string[];
  rules: string[];
}

const keysOf = (value: unknown): string[] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.keys(value)
    : [];

// Config keys are matched exactly, so a typo'd rule key -- or a category
// written as "security" instead of "Security" -- passes validation and then
// matches no rule: a suppression the user believes is active silently does
// nothing. Reported so the caller can warn, deliberately not an error,
// because a config naming a rule that a later release removed should still
// scan. Takes the raw config because validation drops unknown category keys
// before they reach the typed result.
export const collectUnknownConfigKeys = (raw: unknown): UnknownConfigKeys => {
  if (typeof raw !== "object" || raw === null) {
    return { categories: [], rules: [] };
  }

  const knownRuleKeys = new Set(allRules.map((rule) => rule.key));
  const knownCategories = new Set<string>(KNOWN_CATEGORIES);
  const { categories, rules } = raw as {
    categories?: unknown;
    rules?: unknown;
  };

  return {
    categories: keysOf(categories).filter((key) => !knownCategories.has(key)),
    rules: keysOf(rules).filter((key) => !knownRuleKeys.has(key)),
  };
};
