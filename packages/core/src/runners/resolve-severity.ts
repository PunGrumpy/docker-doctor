import type { RuleDefinition, RuleSeverity } from "../types/index";

// Precedence: per-rule config > category config > the rule's default.
export const resolveSeverity = (
  rule: RuleDefinition,
  rulesConfig?: Record<string, RuleSeverity>,
  categoriesConfig?: Record<string, RuleSeverity>
): RuleSeverity =>
  rulesConfig?.[rule.key] ??
  categoriesConfig?.[rule.category] ??
  rule.defaultSeverity;
