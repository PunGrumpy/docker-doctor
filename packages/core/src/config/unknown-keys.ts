import { allRules } from "../rules/index";
import type { ConfigInput } from "../schemas/config";
import {
  IGNORE_CONFIG_KEYS,
  isPlainObject,
  RULE_CATEGORY_NAMES,
  TOP_LEVEL_CONFIG_KEYS,
} from "../schemas/config";
import { closestMatch } from "../suggest";

export interface UnknownConfigKey {
  readonly kind: "category" | "key" | "rule";
  // The key as written, such as "file" for ignore.file.
  readonly key: string;
  // The key with its parents, such as "ignore.file".
  readonly path: string;
  // The known spelling in the same form as path, when one is close.
  readonly suggestion: string | undefined;
}

const sectionKeys = (
  raw: ConfigInput,
  section: "categories" | "ignore" | "rules"
): string[] => {
  const value = raw[section];

  return isPlainObject(value) ? Object.keys(value) : [];
};

// A rule is also matched by the part after its namespace, so a config that
// writes "no-root-user" for "docker-doctor/no-root-user" gets the full key.
const ruleKeyByName = (): ReadonlyMap<string, string> => {
  const byName = new Map<string, string>();

  for (const { key } of allRules) {
    byName.set(key.slice(key.lastIndexOf("/") + 1), key);
    byName.set(key, key);
  }

  return byName;
};

const suggestRuleKey = (
  key: string,
  byName: ReadonlyMap<string, string>
): string | undefined => {
  const match = closestMatch(key, [...byName.keys()]);

  return match === undefined ? undefined : byName.get(match);
};

// Config keys are matched exactly, so a typo'd key, a rule key that names no
// rule, or a category written as "security" instead of "Security" passes
// validation and then does nothing: a setting the user believes is active is
// silently dropped. Reported so the caller can warn, deliberately not an
// error, because a config naming a rule that a later release removed, or a
// key a newer release added, should still scan. Takes the raw config because
// validation drops unknown keys before they reach the typed result.
export const collectUnknownConfigKeys = (
  raw: ConfigInput
): UnknownConfigKey[] => {
  const byName = ruleKeyByName();
  const found: UnknownConfigKey[] = [];

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_CONFIG_KEYS.includes(key)) {
      found.push({
        key,
        kind: "key",
        path: key,
        suggestion: closestMatch(key, TOP_LEVEL_CONFIG_KEYS),
      });
    }
  }

  for (const key of sectionKeys(raw, "ignore")) {
    if (!IGNORE_CONFIG_KEYS.includes(key)) {
      const suggestion = closestMatch(key, IGNORE_CONFIG_KEYS);

      found.push({
        key,
        kind: "key",
        path: `ignore.${key}`,
        suggestion:
          suggestion === undefined ? undefined : `ignore.${suggestion}`,
      });
    }
  }

  for (const key of sectionKeys(raw, "categories")) {
    if (!RULE_CATEGORY_NAMES.some((name) => name === key)) {
      found.push({
        key,
        kind: "category",
        path: `categories.${key}`,
        suggestion: closestMatch(key, RULE_CATEGORY_NAMES),
      });
    }
  }

  for (const key of sectionKeys(raw, "rules")) {
    if (!allRules.some((rule) => rule.key === key)) {
      found.push({
        key,
        kind: "rule",
        path: `rules.${key}`,
        suggestion: suggestRuleKey(key, byName),
      });
    }
  }

  return found;
};
