import type { RuleDefinition, RuleSeverity } from "../types/index";

export const resolveSeverity = (
  rule: RuleDefinition,
  rulesConfig?: Record<string, RuleSeverity>,
  categoriesConfig?: Record<string, RuleSeverity>
): RuleSeverity =>
  rulesConfig?.[rule.key] ??
  categoriesConfig?.[rule.category] ??
  rule.defaultSeverity;
