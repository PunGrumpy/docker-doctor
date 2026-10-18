import { allRules } from "../rules/index";
import type { ConfigInput } from "../schemas/config";
import { isPlainObject } from "../schemas/config";
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

const sectionKeys = (
  raw: ConfigInput,
  section: "categories" | "rules"
): string[] => {
  const value = raw[section];

  return isPlainObject(value) ? Object.keys(value) : [];
};

// Config keys are matched exactly, so a typo'd rule key -- or a category
// written as "security" instead of "Security" -- passes validation and then
// matches no rule: a suppression the user believes is active silently does
// nothing. Reported so the caller can warn, deliberately not an error,
// because a config naming a rule that a later release removed should still
// scan. Takes the raw config because validation drops unknown category keys
// before they reach the typed result.
export const collectUnknownConfigKeys = (
  raw: ConfigInput
): UnknownConfigKeys => {
  const knownRuleKeys = new Set(allRules.map((rule) => rule.key));
  const knownCategories = new Set<string>(KNOWN_CATEGORIES);

  return {
    categories: sectionKeys(raw, "categories").filter(
      (key) => !knownCategories.has(key)
    ),
    rules: sectionKeys(raw, "rules").filter((key) => !knownRuleKeys.has(key)),
  };
};
