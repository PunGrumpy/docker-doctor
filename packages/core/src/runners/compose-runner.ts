import { allComposeRules } from "../rules/index";
import type { Diagnostic, RuleSeverity } from "../types/index";

export const runComposeRules = (
  composeContent: unknown,
  file: string,
  rulesConfig?: Record<string, RuleSeverity>
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allComposeRules) {
    const configSeverity = rulesConfig?.[rule.key];
    if (configSeverity === "off") {
      continue;
    }

    const ruleDiagnostics = rule.check(composeContent, file);

    // Override severity if config specifies it
    if (configSeverity) {
      for (const diag of ruleDiagnostics) {
        diag.severity = configSeverity as "error" | "warning" | "info";
      }
    }

    diagnostics.push(...ruleDiagnostics);
  }

  return diagnostics;
};
