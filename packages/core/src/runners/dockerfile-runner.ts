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

    // Override severity if config resolved to something other than default
    if (severity !== rule.defaultSeverity) {
      for (const diag of ruleDiagnostics) {
        diag.severity = severity;
      }
    }

    diagnostics.push(...ruleDiagnostics);
  }

  return diagnostics;
};
