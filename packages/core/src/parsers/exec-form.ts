// Exec form is a JSON array of strings: CMD ["node", "index.js"]. Docker only
// treats bracket-wrapped args as exec form when they parse as one — anything
// else (e.g. CMD [node, index.js], whose tokens are unquoted) falls back to
// shell form under `/bin/sh -c`.
//
// An array holding a non-string element (CMD [1, 2]) is null here too. Docker
// rejects that outright rather than falling back, so the Dockerfile is broken
// either way and a shell-form diagnostic still points at the offending line.
export const parseExecForm = (args: string): string[] | null => {
  const trimmed = args.trim();
  // Cheap reject first: most instructions are shell form, and reaching them
  // through a thrown JSON.parse would be far more expensive.
  if (!trimmed.startsWith("[")) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }
  if (!parsed.every((el): el is string => typeof el === "string")) {
    return null;
  }

  return parsed;
};
