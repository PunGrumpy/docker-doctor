import { allDockerfileRules } from "../rules/index";
import type {
  DockerfileInstruction,
  Diagnostic,
  RuleSeverity,
} from "../types/index";
import { resolveSeverity } from "./resolve-severity";

export const runDockerfileRules = (
  instructions: DockerfileInstruction[],
  file: string,
  projectFiles: string[],
  rulesConfig?: Record<string, RuleSeverity>,
  categoriesConfig?: Record<string, RuleSeverity>
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allDockerfileRules) {
    const severity = resolveSeverity(rule, rulesConfig, categoriesConfig);
    if (severity === "off") {
      continue;
    }

    const ruleDiagnostics = rule.check(instructions, file, { projectFiles });

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
