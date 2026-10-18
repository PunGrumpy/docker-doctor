import type { Diagnostic, DiagnosticSeverity } from "../types/index";
import { redactSecrets } from "./redact-secrets";

// Messages quote Dockerfile and Compose text. They reach --json output,
// .docker-doctor/, agent prompts, CI logs and PR comments. Every rule
// builds its findings here, so this is the one place that keeps
// credentials out of them.
export const createDiagnostic = (
  file: string,
  ruleKey: string,
  severity: DiagnosticSeverity,
  message: string,
  help: string,
  line?: number
): Diagnostic => ({
  file,
  help: redactSecrets(help),
  line,
  message: redactSecrets(message),
  rule: ruleKey,
  severity,
});
