import type {
  DockerDoctorConfig,
  RuleCategory,
  RuleSeverity,
} from "../types/index";

export type { DockerDoctorConfig } from "../types/index";

const RULE_SEVERITIES: readonly RuleSeverity[] = [
  "error",
  "warning",
  "info",
  "off",
];

const RULE_CATEGORIES: readonly RuleCategory[] = [
  "Best Practices",
  "Compose",
  "Image Size",
  "Performance",
  "Security",
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRuleSeverity = (value: unknown): value is RuleSeverity =>
  typeof value === "string" &&
  (RULE_SEVERITIES as readonly string[]).includes(value);

const validateRules = (value: unknown): Record<string, RuleSeverity> => {
  if (!isPlainObject(value)) {
    throw new Error(
      `Invalid config: "rules" must be an object, got ${typeof value}`
    );
  }

  for (const [key, severity] of Object.entries(value)) {
    if (!isRuleSeverity(severity)) {
      throw new Error(
        `Invalid severity ${JSON.stringify(severity)} for rule "${key}"`
      );
    }
  }

  return value as Record<string, RuleSeverity>;
};

const validateCategories = (
  value: unknown
): Record<RuleCategory, RuleSeverity> => {
  if (!isPlainObject(value)) {
    throw new Error(
      `Invalid config: "categories" must be an object, got ${typeof value}`
    );
  }

  const result: Partial<Record<RuleCategory, RuleSeverity>> = {};
  for (const [key, severity] of Object.entries(value)) {
    if (!(RULE_CATEGORIES as readonly string[]).includes(key)) {
      // Unknown category keys are silently dropped (matches the
      // legacy schema's excess-property behavior).
      continue;
    }
    if (!isRuleSeverity(severity)) {
      throw new Error(
        `Invalid severity ${JSON.stringify(severity)} for category "${key}"`
      );
    }
    result[key as RuleCategory] = severity;
  }

  return result as Record<RuleCategory, RuleSeverity>;
};

const validateIgnore = (value: unknown): { files?: string[] } => {
  if (!isPlainObject(value)) {
    throw new Error(
      `Invalid config: "ignore" must be an object, got ${typeof value}`
    );
  }

  const result: { files?: string[] } = {};
  if ("files" in value && value.files !== undefined) {
    if (
      !Array.isArray(value.files) ||
      !value.files.every((item) => typeof item === "string")
    ) {
      throw new Error(
        'Invalid config: "ignore.files" must be an array of strings'
      );
    }
    result.files = value.files;
  }

  return result;
};

const describeInvalidTopLevel = (input: unknown): string => {
  if (input === null) {
    return "null";
  }
  if (Array.isArray(input)) {
    return "array";
  }
  return typeof input;
};

/**
 * Validates and normalizes a raw config object, throwing on invalid input.
 *
 * Mirrors the legacy schema's behavior exactly, including silently
 * dropping unknown top-level (and nested) keys rather than throwing
 * or preserving them.
 */
export const validateConfig = (input: unknown): DockerDoctorConfig => {
  if (!isPlainObject(input)) {
    throw new Error(
      `Invalid config: expected an object, got ${describeInvalidTopLevel(input)}`
    );
  }

  const result: DockerDoctorConfig = {};

  if ("rules" in input && input.rules !== undefined) {
    result.rules = validateRules(input.rules);
  }

  if ("categories" in input && input.categories !== undefined) {
    result.categories = validateCategories(input.categories);
  }

  if ("ignore" in input && input.ignore !== undefined) {
    result.ignore = validateIgnore(input.ignore);
  }

  return result;
};
