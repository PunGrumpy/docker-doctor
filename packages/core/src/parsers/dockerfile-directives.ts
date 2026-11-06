import { hasText } from "../text";
import type { DockerfileDirectives } from "../types/index";

const DIRECTIVE_RE = /^#\s*(?<key>[a-zA-Z][a-zA-Z0-9]*)\s*=(?<value>.*)$/u;
const LEADING_BOM = /^\uFEFF/u;
const DIRECTIVE_KEYS = new Set(["check", "escape", "syntax"]);

export const parseDockerfileDirectives = (
  content: string
): DockerfileDirectives => {
  const directives: DockerfileDirectives = {};
  const lines = content.replace(LEADING_BOM, "").split(/\r?\n/u);

  const skipped = lines[0]?.startsWith("#!") ? 1 : 0;

  for (const [index, line] of lines.slice(skipped).entries()) {
    const groups = DIRECTIVE_RE.exec(line)?.groups;
    const key = groups?.key?.toLowerCase();
    const value = groups?.value?.trim();

    if (key === undefined || !hasText(value) || !DIRECTIVE_KEYS.has(key)) {
      break;
    }

    if (key === "syntax") {
      directives.syntax ??= { line: index + skipped + 1, value };
    }
  }

  return directives;
};
