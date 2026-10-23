import type {
  DockerDoctorConfig,
  RuleCategory,
  RuleSeverity,
} from "../types/index";

export type { DockerDoctorConfig } from "../types/index";

const RULE_SEVERITIES: ReadonlySet<string> = new Set<RuleSeverity>([
  "error",
  "warning",
  "info",
  "off",
]);

const RULE_CATEGORIES: ReadonlySet<string> = new Set<RuleCategory>([
  "Best Practices",
  "Compose",
  "Image Size",
  "Performance",
  "Security",
]);

export interface ConfigInput {
  readonly categories?: unknown;
  readonly ignore?: unknown;
  readonly rules?: unknown;
}

interface CategorySection {
  readonly "Best Practices"?: unknown;
  readonly Compose?: unknown;
  readonly "Image Size"?: unknown;
  readonly Performance?: unknown;
  readonly Security?: unknown;
}

interface IgnoreSection {
  readonly files?: unknown;
}

export const isPlainObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isRuleSeverity = (value: unknown): value is RuleSeverity =>
  typeof value === "string" && RULE_SEVERITIES.has(value);

const isRuleCategory = (key: string): key is RuleCategory =>
  RULE_CATEGORIES.has(key);

// Each section check is a type predicate that returns true or throws. The
// typeof that names a bad value's type in the message stays inside it.
const isSectionObject = (
  value: unknown,
  section: string
): value is CategorySection & IgnoreSection => {
  if (isPlainObject(value)) {
    return true;
  }

  throw new Error(
    `Invalid config: "${section}" must be an object, got ${typeof value}`
  );
};

const isRuleSeverityMap = (
  rules: unknown
): rules is Readonly<Record<string, RuleSeverity>> => {
  if (!isSectionObject(rules, "rules")) {
    return false;
  }

  for (const [key, severity] of Object.entries(rules)) {
    if (!isRuleSeverity(severity)) {
      throw new Error(
        `Invalid severity ${JSON.stringify(severity)} for rule "${key}"`
      );
    }
  }

  return true;
};

const validateCategories = (
  categories: CategorySection
): Partial<Record<RuleCategory, RuleSeverity>> => {
  const result: Partial<Record<RuleCategory, RuleSeverity>> = {};

  for (const [key, severity] of Object.entries(categories)) {
    if (!isRuleCategory(key)) {
      continue;
    }

    if (!isRuleSeverity(severity)) {
      throw new Error(
        `Invalid severity ${JSON.stringify(severity)} for category "${key}"`
      );
    }

    result[key] = severity;
  }

  return result;
};

const isFileList = (files: unknown): files is string[] =>
  Array.isArray(files) && files.every(isString);

const validateIgnore = (
  ignore: IgnoreSection
): DockerDoctorConfig["ignore"] => {
  if (ignore.files === undefined) {
    return {};
  }

  if (!isFileList(ignore.files)) {
    throw new Error(
      'Invalid config: "ignore.files" must be an array of strings'
    );
  }

  return { files: ignore.files };
};

// Returns true or throws, like the section checks.
export const isConfigObject = (input: unknown): input is ConfigInput => {
  if (isPlainObject(input)) {
    return true;
  }

  let received: string = typeof input;

  if (input === null) {
    received = "null";
  } else if (Array.isArray(input)) {
    received = "array";
  }

  throw new Error(`Invalid config: expected an object, got ${received}`);
};

export const validateConfig = (input: ConfigInput): DockerDoctorConfig => {
  const result: DockerDoctorConfig = {};

  if (input.rules !== undefined && isRuleSeverityMap(input.rules)) {
    result.rules = input.rules;
  }

  if (
    input.categories !== undefined &&
    isSectionObject(input.categories, "categories")
  ) {
    result.categories = validateCategories(input.categories);
  }

  if (input.ignore !== undefined && isSectionObject(input.ignore, "ignore")) {
    result.ignore = validateIgnore(input.ignore);
  }

  return result;
};
