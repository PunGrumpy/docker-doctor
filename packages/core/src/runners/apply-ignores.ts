import { findRuleByName } from "../rules/index";
import { redactSecrets } from "../rules/redact-secrets";
import type {
  Diagnostic,
  FileIgnores,
  IgnoreDirective,
  SuppressedDiagnostic,
} from "../types/index";

export interface IgnoreFileWarning {
  file: string;
  line: number;
  message: string;
}

export interface IgnoreResult {
  diagnostics: Diagnostic[];
  suppressed: SuppressedDiagnostic[];
  warnings: IgnoreFileWarning[];
}

interface Reason {
  reason: string | null;
}

interface RuleIgnores {
  file: Reason | null;
  lines: Map<number, Reason>;
}

type FileRuleIgnores = Map<string, RuleIgnores>;

const addDirective = (
  ignores: FileRuleIgnores,
  directive: IgnoreDirective,
  ruleKey: string
): void => {
  const entry = ignores.get(ruleKey) ?? { file: null, lines: new Map() };
  const { reason } = directive;

  ignores.set(ruleKey, entry);

  if (directive.scope.kind === "file") {
    entry.file ??= { reason };
  } else if (!entry.lines.has(directive.scope.line)) {
    entry.lines.set(directive.scope.line, { reason });
  }
};

interface IndexedFile {
  ignores: FileRuleIgnores;
  warnings: IgnoreFileWarning[];
}

const indexFile = (
  file: string,
  { directives, warnings }: FileIgnores
): IndexedFile => {
  const ignores: FileRuleIgnores = new Map();
  const fileWarnings = warnings.map((warning) => ({ file, ...warning }));

  for (const directive of directives) {
    for (const name of directive.names) {
      const rule = findRuleByName(name);

      if (rule === undefined) {
        fileWarnings.push({
          file,
          line: directive.line,
          message: `unknown rule "${name}" in an ignore comment`,
        });
      } else {
        addDirective(ignores, directive, rule.key);
      }
    }
  }

  return {
    ignores,
    warnings: fileWarnings.toSorted((a, b) => a.line - b.line),
  };
};

const matchReason = (
  ignores: FileRuleIgnores | undefined,
  diagnostic: Diagnostic
): Reason | null => {
  const entry = ignores?.get(diagnostic.rule);

  if (entry === undefined) {
    return null;
  }

  const onLine =
    diagnostic.line === undefined
      ? undefined
      : entry.lines.get(diagnostic.line);

  return onLine ?? entry.file;
};

/**
 * Splits the final diagnostic list into the findings that count and the ones
 * an ignore comment suppressed, matching each by file, rule and line. A
 * file-wide ignore also covers findings that have no line.
 */
export const applyIgnores = (
  diagnostics: Diagnostic[],
  ignoresByFile: ReadonlyMap<string, FileIgnores>
): IgnoreResult => {
  const indexed = new Map<string, FileRuleIgnores>();
  const warnings: IgnoreFileWarning[] = [];

  for (const [file, fileIgnores] of ignoresByFile) {
    const result = indexFile(file, fileIgnores);

    indexed.set(file, result.ignores);
    warnings.push(...result.warnings);
  }

  const live: Diagnostic[] = [];
  const suppressed: SuppressedDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const match = matchReason(indexed.get(diagnostic.file), diagnostic);

    if (match === null) {
      live.push(diagnostic);
    } else {
      suppressed.push({
        ...diagnostic,
        reason: match.reason === null ? null : redactSecrets(match.reason),
      });
    }
  }

  return { diagnostics: live, suppressed, warnings };
};
