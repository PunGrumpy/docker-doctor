import { allDockerfileRules } from "../rules/index";
import type {
  DockerfileInstruction,
  Diagnostic,
  RuleSeverity,
} from "../types/index";

export const runDockerfileRules = (
  instructions: DockerfileInstruction[],
  file: string,
  projectFiles: string[],
  rulesConfig?: Record<string, RuleSeverity>
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allDockerfileRules) {
    const configSeverity = rulesConfig?.[rule.key];
    if (configSeverity === "off") {
      continue;
    }

    const ruleDiagnostics = rule.check(instructions, file, { projectFiles });

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
