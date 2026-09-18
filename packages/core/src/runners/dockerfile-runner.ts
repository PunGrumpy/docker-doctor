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
  // A file with no instructions (empty, comment-only, a stub) has nothing
  // to check. Whole-file rules such as no-root-user would otherwise report
  // the absence of a USER line as "runs as root".
  if (instructions.length === 0) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];

  for (const rule of allDockerfileRules) {
    const severity = resolveSeverity(rule, rulesConfig, categoriesConfig);
    if (severity === "off") {
      continue;
    }

    const ruleDiagnostics = rule.check(instructions, file, { projectFiles });

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
