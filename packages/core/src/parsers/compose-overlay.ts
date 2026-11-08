import nodePath from "node:path";

import type { ComposeMapping, ComposeValue } from "../types/index";
import type { ComposeFile, ComposePath } from "./compose-parser";
import {
  isComposeMapping,
  isComposeSequence,
  isComposeString,
} from "./compose-value";

const { posix } = nodePath;

// compose-go `cli/options.go:485` and `:488`, each in order of preference.
const BASE_FILE_NAMES = [
  "compose.yaml",
  "compose.yml",
  "docker-compose.yml",
  "docker-compose.yaml",
];

const OVERRIDE_FILE_NAMES = [
  "compose.override.yml",
  "compose.override.yaml",
  "docker-compose.override.yml",
  "docker-compose.override.yaml",
];

/** A base file and the override Compose merges over it by default. */
export interface ComposeOverlay {
  base: string;
  override: string;
}

const pickByPreference = (
  names: ReadonlySet<string>,
  preference: readonly string[]
): string[] => preference.filter((name) => names.has(name));

const describeChoice = (
  dir: string,
  kind: "base" | "override",
  found: readonly string[]
): string => {
  const paths = found.map((name) => posix.join(dir, name));
  const partner = kind === "base" ? "override" : "base";

  return `Found several Compose ${kind} files with supported names (${paths.join(", ")}). Compose uses ${paths[0]}. Docker Doctor pairs ${paths[0]} with the ${partner} file and still judges ${paths.slice(1).join(", ")} alone.`;
};

/**
 * Pairs each directory's base Compose file with the override Compose loads
 * after it when no `-f` is given (compose-go `WithDefaultConfigPath`,
 * `cli/options.go:222-242`): the first base name present, then the first
 * override name present in the same directory. An override with no base
 * beside it is never loaded by default, so it is not paired.
 */
export const pairComposeFiles = (
  files: readonly string[],
  onWarning?: (message: string) => void
): ComposeOverlay[] => {
  const namesByDir = new Map<string, Set<string>>();

  for (const file of files) {
    const dir = posix.dirname(file);
    const names = namesByDir.get(dir) ?? new Set<string>();
    names.add(posix.basename(file));
    namesByDir.set(dir, names);
  }

  const overlays: ComposeOverlay[] = [];

  for (const [dir, names] of namesByDir) {
    const bases = pickByPreference(names, BASE_FILE_NAMES);
    const overrides = pickByPreference(names, OVERRIDE_FILE_NAMES);
    const [base] = bases;
    const [override] = overrides;

    if (base === undefined || override === undefined) {
      continue;
    }

    if (bases.length > 1) {
      onWarning?.(describeChoice(dir, "base", bases));
    }

    if (overrides.length > 1) {
      onWarning?.(describeChoice(dir, "override", overrides));
    }

    overlays.push({
      base: posix.join(dir, base),
      override: posix.join(dir, override),
    });
  }

  return overlays;
};

const isDeepEqual = (left: ComposeValue, right: ComposeValue): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

// `override/merge.go:202-210`: override entries are appended unless an
// identical entry is already there.
const appendWithoutDuplicates = (
  base: readonly ComposeValue[],
  override: readonly ComposeValue[]
): ComposeValue[] => {
  const merged = [...base];

  for (const entry of override) {
    if (!merged.some((existing) => isDeepEqual(existing, entry))) {
      merged.push(entry);
    }
  }

  return merged;
};

// `override/merge.go:320-342`: the short list form becomes a mapping, each
// entry taking the attribute's defaults.
const toMapping = (
  value: ComposeValue,
  entryDefault: ComposeValue
): ComposeMapping => {
  if (isComposeMapping(value)) {
    return value;
  }

  const entries = isComposeSequence(value) ? value : [value];

  return Object.fromEntries(
    entries.flatMap((name) =>
      isComposeString(name) ? [[name, entryDefault]] : []
    )
  );
};

// The special cases of `override/merge.go:42-76` that the effective-service
// rules read, as the default each entry of the short list form takes. Both
// merge as mappings (`merge.go:161-170`). Every other path merges by the
// generic rule, which only approximates compose-go for `environment`,
// `labels`, `volumes` and the like. No rule reads those from the merged
// project.
const MAPPING_ATTRIBUTES = new Map<string, ComposeValue>([
  ["depends_on", { condition: "service_started", required: true }],
  ["models", null],
]);

// The entry default when the path is a service attribute Compose merges as
// a mapping, else undefined.
const mappingEntryDefault = (path: ComposePath): ComposeValue | undefined => {
  const [root, , attribute, ...rest] = path;

  return root === "services" && attribute !== undefined && rest.length === 0
    ? MAPPING_ATTRIBUTES.get(attribute)
    : undefined;
};

// `override/merge.go:79-125`
const mergeValue = (
  base: ComposeValue,
  override: ComposeValue,
  path: ComposePath
): ComposeValue => {
  const entryDefault = mappingEntryDefault(path);

  const left =
    entryDefault === undefined ? base : toMapping(base ?? {}, entryDefault);

  const right =
    entryDefault === undefined
      ? override
      : toMapping(override ?? {}, entryDefault);

  // A null override keeps the base value. Only `!reset` removes it.
  if (right === null) {
    return left;
  }

  if (isComposeMapping(left) && isComposeMapping(right)) {
    const merged = new Map(Object.entries(left));

    for (const [key, value] of Object.entries(right)) {
      const existing = merged.get(key);

      if (value !== undefined) {
        merged.set(
          key,
          existing === undefined
            ? value
            : mergeValue(existing, value, [...path, key])
        );
      }
    }

    return Object.fromEntries(merged);
  }

  if (isComposeSequence(left) && isComposeSequence(right)) {
    return appendWithoutDuplicates(left, right);
  }

  return right;
};

// `loader/reset.go:285-324`: the value at a tagged path is deleted from the
// files loaded so far, before the tagged file merges over them.
const withoutPath = (value: ComposeValue, path: ComposePath): ComposeValue => {
  const [key, ...rest] = path;

  if (key === undefined || !isComposeMapping(value) || !(key in value)) {
    return value;
  }

  if (rest.length === 0) {
    return Object.fromEntries(
      Object.entries(value).filter(([name]) => name !== key)
    );
  }

  return { ...value, [key]: withoutPath(value[key] ?? null, rest) };
};

/**
 * The project Compose runs from a base file and its override: the override's
 * `!reset` and `!override` paths are deleted from the base, then the
 * override merges over it (compose-go `loader/loader.go:623` and `:637`).
 */
export const overlayCompose = (
  base: ComposeFile,
  override: ComposeFile
): ComposeValue => {
  let cleared = base.document;

  for (const path of override.replacedPaths) {
    cleared = withoutPath(cleared, path);
  }

  return mergeValue(cleared, override.document, []);
};
