import type {
  DockerDoctorConfig,
  RuleCategory,
  RuleSeverity,
} from "../types/index";

export type { DockerDoctorConfig } from "../types/index";

const RULE_SEVERITY_VALUES: readonly RuleSeverity[] = [
  "error",
  "warning",
  "info",
  "off",
];

const RULE_SEVERITIES: ReadonlySet<string> = new Set<string>(
  RULE_SEVERITY_VALUES
);

const SEVERITY_CHOICES = RULE_SEVERITY_VALUES.join(", ");

export const RULE_CATEGORY_NAMES: readonly RuleCategory[] = [
  "Best Practices",
  "Compose",
  "Image Size",
  "Performance",
  "Security",
];

const RULE_CATEGORIES: ReadonlySet<string> = new Set<string>(
  RULE_CATEGORY_NAMES
);

// The keys a config file may hold. apps/web/app/schema.json/route.ts and
// apps/web/content/docs/reference/configuration.mdx list the same keys.
// `$schema` is for editors and is not read.
export const TOP_LEVEL_CONFIG_KEYS: readonly string[] = [
  "$schema",
  "categories",
  "ignore",
  "rules",
];

export const IGNORE_CONFIG_KEYS: readonly string[] = ["files"];

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

const CLASS_TAG_PREFIX_LENGTH = "[object ".length;

// The class tag tells null and an array apart, which typeof calls "object".
const typeName = (classTag: string): string =>
  classTag.slice(CLASS_TAG_PREFIX_LENGTH, -1).toLowerCase();

// A config value can hold a token, so a bad severity is quoted only when it
// is short. Anything longer, and any non-string, is named by its type.
const MAX_QUOTED_VALUE_LENGTH = 20;

// Returns true or throws, like the section checks.
const isRuleSeverity = (
  value: unknown,
  kind: "category" | "rule",
  key: string
): value is RuleSeverity => {
  if (typeof value === "string" && RULE_SEVERITIES.has(value)) {
    return true;
  }

  const subject = `${kind} "${key}"`;

  if (typeof value === "string" && value.length <= MAX_QUOTED_VALUE_LENGTH) {
    throw new Error(
      `Invalid severity ${JSON.stringify(value)} for ${subject}. Use ${SEVERITY_CHOICES}.`
    );
  }

  const got =
    typeof value === "string"
      ? `a ${value.length}-character string`
      : typeName(Object.prototype.toString.call(value));

  throw new Error(
    `Invalid severity for ${subject}, got ${got}. Use ${SEVERITY_CHOICES}.`
  );
};

const isRuleCategory = (key: string): key is RuleCategory =>
  RULE_CATEGORIES.has(key);

// Each section check is a type predicate that returns true or throws. The
// code that names a bad value's type in the message stays inside it.
const isSectionObject = (
  value: unknown,
  subject: string
): value is CategorySection & IgnoreSection => {
  if (isPlainObject(value)) {
    return true;
  }

  const found = typeName(Object.prototype.toString.call(value));

  throw new Error(`${subject} must be an object, got ${found}`);
};

const isRuleSeverityMap = (
  rules: unknown
): rules is Readonly<Record<string, RuleSeverity>> => {
  if (!isSectionObject(rules, '"rules"')) {
    return false;
  }

  for (const [key, severity] of Object.entries(rules)) {
    if (!isRuleSeverity(severity, "rule", key)) {
      return false;
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

    if (isRuleSeverity(severity, "category", key)) {
      result[key] = severity;
    }
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
    throw new Error('"ignore.files" must be an array of strings');
  }

  return { files: ignore.files };
};

// Returns true or throws, like the section checks.
export const isConfigObject = (input: unknown): input is ConfigInput =>
  isSectionObject(input, "The config");

export const validateConfig = (input: ConfigInput): DockerDoctorConfig => {
  const result: DockerDoctorConfig = {};

  if (input.rules !== undefined && isRuleSeverityMap(input.rules)) {
    result.rules = input.rules;
  }

  if (
    input.categories !== undefined &&
    isSectionObject(input.categories, '"categories"')
  ) {
    result.categories = validateCategories(input.categories);
  }

  if (input.ignore !== undefined && isSectionObject(input.ignore, '"ignore"')) {
    result.ignore = validateIgnore(input.ignore);
  }

  return result;
};
