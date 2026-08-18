import type { Diagnostic } from "@docker-doctor/core";
import { findRule } from "@docker-doctor/core";

import {
  DIAGNOSTICS_DIR_NAME,
  groupDiagnosticsByRule,
  TRUST_BOUNDARY_NOTE,
} from "./diagnostics-dir";

const MAX_FILES_PER_RULE = 5;

const SEVERITY_RANK: Record<Diagnostic["severity"], number> = {
  error: 0,
  info: 2,
  warning: 1,
};

const SEVERITY_LABEL: Record<Diagnostic["severity"], string> = {
  error: "ERROR",
  info: "INFO",
  warning: "WARN",
};

export interface HandoffPayloadInput {
  diagnostics: Diagnostic[];
  projectName: string;
}

const MAX_MESSAGE_LENGTH = 300;

// Rule messages quote content from the scanned files verbatim. Before that
// content enters an agent prompt it is flattened to one line, stripped of
// control characters (including ANSI escapes), and length-capped — and the
// prompt itself declares it untrusted (see the header line below).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]+/gu;

const sanitizeMessage = (message: string): string => {
  const flat = message.replaceAll(CONTROL_CHARS_RE, " ").trim();
  return flat.length > MAX_MESSAGE_LENGTH
    ? `${flat.slice(0, MAX_MESSAGE_LENGTH)}…`
    : flat;
};

// The prompt handed to the chosen agent: every rule group inline (docker
// projects rarely have hundreds of findings), errors first, each with its fix
// recipe and affected files, plus a pointer to the full on-disk report.
export const buildHandoffPayload = (input: HandoffPayloadInput): string => {
  const groups = [
    ...groupDiagnosticsByRule(input.diagnostics).entries(),
  ].toSorted(([, a], [, b]) => {
    const rankDelta =
      SEVERITY_RANK[a[0].severity] - SEVERITY_RANK[b[0].severity];
    return rankDelta === 0 ? b.length - a.length : rankDelta;
  });

  const issueCount = input.diagnostics.length;
  const issueWord = issueCount === 1 ? "issue" : "issues";
  const ruleWord = groups.length === 1 ? "rule" : "rules";
  const lines: string[] = [
    `Fix the ${issueCount} Docker Doctor ${issueWord} (${groups.length} ${ruleWord}) in ${input.projectName}.`,
    TRUST_BOUNDARY_NOTE,
    "",
  ];

  for (const [index, [rule, ruleDiagnostics]] of groups.entries()) {
    const [first] = ruleDiagnostics;
    const category = findRule(rule)?.category ?? "General";
    const countBadge =
      ruleDiagnostics.length > 1 ? ` (×${ruleDiagnostics.length})` : "";
    lines.push(
      `${index + 1}. ${SEVERITY_LABEL[first.severity]} ${category}: ${sanitizeMessage(first.message)} [${rule}]${countBadge}`,
      `   Fix: ${first.help}`
    );
    const files = [...new Set(ruleDiagnostics.map((d) => d.file))];
    for (const file of files.slice(0, MAX_FILES_PER_RULE)) {
      const firstSite = ruleDiagnostics.find(
        (d) => d.file === file && d.line !== undefined
      );
      lines.push(`   - ${file}${firstSite ? `:${firstSite.line}` : ""}`);
    }
    const remaining = files.length - MAX_FILES_PER_RULE;
    if (remaining > 0) {
      lines.push(`   - +${remaining} more files`);
    }
  }

  lines.push(
    "",
    `Full report (diagnostics.json + a .txt per rule): ${DIAGNOSTICS_DIR_NAME}/`,
    "",
    "Read each file and fix the root cause — don't suppress or silence the rule.",
    "When you're done, re-run `npx @docker-doctor/cli@latest .` and confirm the score improved and no errors remain."
  );

  return lines.join("\n");
};
