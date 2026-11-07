import { hasText } from "../text";
import type { DockerfileDirectives } from "../types/index";

const DIRECTIVE_RE = /^#\s*(?<key>[a-zA-Z][a-zA-Z0-9]*)\s*=(?<value>.*)$/u;
const LEADING_BOM = /^\uFEFF/u;
const DIRECTIVE_KEYS = new Set(["check", "escape", "syntax"]);

export const stripLeadingBom = (content: string): string =>
  content.replace(LEADING_BOM, "");

// A parser directive is a `# key=value` comment with a key BuildKit knows.
export const matchParserDirective = (
  line: string
): { key: string; value: string } | null => {
  const groups = DIRECTIVE_RE.exec(line)?.groups;
  const key = groups?.key?.toLowerCase();
  const value = groups?.value?.trim();

  if (key === undefined || !hasText(value) || !DIRECTIVE_KEYS.has(key)) {
    return null;
  }

  return { key, value };
};

export const parseDockerfileDirectives = (
  content: string
): DockerfileDirectives => {
  const directives: DockerfileDirectives = {};
  const lines = stripLeadingBom(content).split(/\r?\n/u);

  const skipped = lines[0]?.startsWith("#!") ? 1 : 0;

  for (const [index, line] of lines.slice(skipped).entries()) {
    const directive = matchParserDirective(line);

    if (directive === null) {
      break;
    }

    if (directive.key === "syntax") {
      directives.syntax ??= {
        line: index + skipped + 1,
        value: directive.value,
      };
    }
  }

  return directives;
};
