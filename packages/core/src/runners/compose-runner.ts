import { allComposeRules } from "../rules/index";
import type { ComposeLocator, Diagnostic, RuleSeverity } from "../types/index";
import { resolveSeverity } from "./resolve-severity";

export const runComposeRules = (
  composeContent: unknown,
  file: string,
  rulesConfig?: Record<string, RuleSeverity>,
  categoriesConfig?: Record<string, RuleSeverity>,
  locate?: ComposeLocator
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allComposeRules) {
    const severity = resolveSeverity(rule, rulesConfig, categoriesConfig);
    if (severity === "off") {
      continue;
    }

    const ruleDiagnostics = rule.check(composeContent, file, { locate });

    // Stamp the owning rule's category; override severity only when the
    // config resolved to something other than the rule's default.
    for (const diag of ruleDiagnostics) {
      diag.category = rule.category;
      if (severity !== rule.defaultSeverity) {
        diag.severity = severity;
      }
    }

    diagnostics.push(...ruleDiagnostics);
  }

  return diagnostics;
};
