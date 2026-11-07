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

const MAX_UNKNOWN_NAME_LENGTH = 80;

// Controls, format characters (zero-width, bidi, tag characters) and the line
// and paragraph separators. The warning goes to a terminal, and the name is
// whatever the comment's author typed.
const HIDDEN_CHARS_RE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{E0000}-\u{E007F}]+/gu;

// Hidden characters go first so they cannot split a credential that
// redactSecrets would otherwise mask.
const describeUnknownName = (name: string): string => {
  const safe = redactSecrets(name.replaceAll(HIDDEN_CHARS_RE, ""));

  const shown =
    safe.length > MAX_UNKNOWN_NAME_LENGTH
      ? `${safe.slice(0, MAX_UNKNOWN_NAME_LENGTH)}…`
      : safe;

  return `"${shown}"`;
};

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
    const unknown: string[] = [];

    for (const name of directive.names) {
      const rule = findRuleByName(name);

      if (rule === undefined) {
        unknown.push(describeUnknownName(name));
      } else {
        addDirective(ignores, directive, rule.key);
      }
    }

    if (unknown.length > 0) {
      const noun = unknown.length === 1 ? "rule" : "rules";

      fileWarnings.push({
        file,
        line: directive.line,
        message: `unknown ${noun} ${unknown.join(", ")} in an ignore comment`,
      });
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
