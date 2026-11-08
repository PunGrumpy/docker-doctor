import { overlayCompose, pairComposeFiles } from "../parsers/compose-overlay";
import type { ComposeFile, ComposePath } from "../parsers/compose-parser";
import { composeField } from "../parsers/compose-value";
import { requireResourceLimits, requireRestartPolicy } from "../rules/compose";
import { undefinedModelReference } from "../rules/compose-models";
import { composeServices } from "../rules/compose-services";
import { allComposeRules } from "../rules/index";
import type {
  ComposeLocator,
  ComposeRule,
  ComposeValue,
  Diagnostic,
  RuleSeverity,
} from "../types/index";
import { isAnalyzableCompose } from "./analyzable";
import { resolveSeverity } from "./resolve-severity";

interface RuleSettings {
  rulesConfig?: Record<string, RuleSeverity>;
  categoriesConfig?: Record<string, RuleSeverity>;
}

// What one rule reads for one file: the services to judge, the locator for
// their lines, and the project they belong to when that is more than the
// file.
interface RuleInput {
  content: ComposeValue;
  locate?: ComposeLocator;
  project?: ComposeValue;
}

type InputFor = (rule: ComposeRule) => RuleInput;

const applyRules = (
  file: string,
  inputFor: InputFor,
  { rulesConfig, categoriesConfig }: RuleSettings
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allComposeRules) {
    const severity = resolveSeverity(rule, rulesConfig, categoriesConfig);

    if (severity === "off") {
      continue;
    }

    const { content, locate, project } = inputFor(rule);
    const ruleDiagnostics = rule.check(content, file, { locate, project });

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

export const runComposeRules = (
  composeContent: ComposeValue,
  file: string,
  rulesConfig?: Record<string, RuleSeverity>,
  categoriesConfig?: Record<string, RuleSeverity>,
  locate?: ComposeLocator
): Diagnostic[] => {
  // Only analyzable files count toward the score, so only they may
  // produce findings.
  if (!isAnalyzableCompose(composeContent)) {
    return [];
  }

  return applyRules(file, () => ({ content: composeContent, locate }), {
    categoriesConfig,
    rulesConfig,
  });
};

// The rules that report a setting a service lacks, each with the settings
// it looks for in a service. Compose runs a base file merged with its
// override, so these judge the merged service.
const EFFECTIVE_SERVICE_RULES: ReadonlyMap<
  ComposeRule,
  readonly ComposePath[]
> = new Map([
  [
    requireResourceLimits,
    [
      ["deploy", "resources", "limits", "cpus"],
      ["deploy", "resources", "limits", "memory"],
      ["mem_limit"],
      ["cpus"],
      ["cpu_quota"],
    ],
  ],
  [requireRestartPolicy, [["restart"], ["deploy", "restart_policy"]]],
]);

// The rules that report a name a file writes. They judge each file's own
// lines but look the name up in the merged project, where a model the base
// declares can serve a reference in the override.
const PROJECT_LOOKUP_RULES: ReadonlySet<ComposeRule> = new Set([
  undefinedModelReference,
]);

/** One parsed Compose file of a scan. */
export interface ComposeSource {
  file: string;
  compose: ComposeFile;
  locate?: ComposeLocator;
}

const ownInput = ({ compose, locate }: ComposeSource): RuleInput => ({
  content: compose.document,
  locate,
});

const servicesNamed = (
  project: ComposeValue,
  keep: (name: string) => boolean
): ComposeValue => ({
  services: Object.fromEntries(
    composeServices(project).filter(([name]) => keep(name))
  ),
});

const valueAt = (
  value: ComposeValue | undefined,
  path: ComposePath
): ComposeValue | undefined => {
  let node = value;

  for (const key of path) {
    node = composeField(node, key);
  }

  return node;
};

const isPrefix = (prefix: ComposePath, path: ComposePath): boolean =>
  prefix.length <= path.length &&
  prefix.every((key, index) => path[index] === key);

// For each base service that set one of `settings`, the first `!reset` or
// `!override` path of the override that takes it away. Compose deletes the
// base value at that path before the merge (compose-go
// `loader/reset.go:285-324`), so setting it again in the base cannot help.
const removedByOverride = (
  settings: readonly ComposePath[],
  base: ComposeValue,
  replacedPaths: readonly ComposePath[]
): Map<string, ComposePath> => {
  const onServices: ComposePath[] = [];
  const byService = new Map<string, ComposePath[]>();

  for (const path of replacedPaths) {
    const [root, name] = path;

    if (root !== "services") {
      continue;
    }

    // A tag on `services` itself reaches every service.
    if (name === undefined) {
      onServices.push(path);
    } else {
      const tags = byService.get(name) ?? [];
      tags.push(path);
      byService.set(name, tags);
    }
  }

  const removed = new Map<string, ComposePath>();

  for (const [name, config] of composeServices(base)) {
    const held = settings.flatMap((setting) =>
      valueAt(config, setting) === undefined
        ? []
        : [["services", name, ...setting]]
    );

    const removal = [...onServices, ...(byService.get(name) ?? [])].find(
      (path) => held.some((setting) => isPrefix(path, setting))
    );

    if (removal !== undefined) {
      removed.set(name, removal);
    }
  }

  return removed;
};

// The override's locator, with each service whose setting it removed placed
// at the tag that removed it. A tag reached through a merge key has no node
// at the service, so the nearest enclosing node the file writes stands in.
const locateRemovals = (
  locate: ComposeLocator | undefined,
  removed: ReadonlyMap<string, ComposePath>
): ComposeLocator | undefined => {
  if (locate === undefined) {
    return undefined;
  }

  return (path) => {
    const [root, name] = path;

    const removal =
      path.length === 2 && root === "services"
        ? removed.get(String(name))
        : undefined;

    if (removal === undefined) {
      return locate(path);
    }

    return removal
      .map((_, index) => locate(removal.slice(0, removal.length - index)))
      .find((line) => line !== undefined);
  };
};

const inputsFor =
  (
    source: ComposeSource,
    project: ComposeValue,
    merged: ReadonlyMap<ComposeRule, RuleInput>
  ): InputFor =>
  (rule) => {
    const input = merged.get(rule);

    if (input !== undefined) {
      return input;
    }

    return PROJECT_LOOKUP_RULES.has(rule)
      ? { ...ownInput(source), project }
      : ownInput(source);
  };

// What each rule reads for the base and the override of one pair. The base
// answers for a missing setting of a service it defines, at the service's
// line, because that is where a user adds one. When the override took the
// setting away with `!reset` or `!override`, the override answers for it, at
// that tag, because only the override can give it back. The override also
// answers for the services only it defines.
const pairInputs = (
  base: ComposeSource,
  override: ComposeSource
): [InputFor, InputFor] => {
  const project = overlayCompose(base.compose, override.compose);

  const inBase = new Set<string>(
    composeServices(base.compose.document).map(([name]) => name)
  );

  const baseInputs = new Map<ComposeRule, RuleInput>();
  const overrideInputs = new Map<ComposeRule, RuleInput>();

  for (const [rule, settings] of EFFECTIVE_SERVICE_RULES) {
    const removed = removedByOverride(
      settings,
      base.compose.document,
      override.compose.replacedPaths
    );

    const onBase = (name: string) => inBase.has(name) && !removed.has(name);

    baseInputs.set(rule, {
      content: servicesNamed(project, onBase),
      locate: base.locate,
      project,
    });
    overrideInputs.set(rule, {
      content: servicesNamed(project, (name) => !onBase(name)),
      locate: locateRemovals(override.locate, removed),
      project,
    });
  }

  return [
    inputsFor(base, project, baseInputs),
    inputsFor(override, project, overrideInputs),
  ];
};

const pairedInputs = (
  sources: readonly ComposeSource[],
  onWarning?: (message: string) => void
): Map<string, InputFor> => {
  const byFile = new Map(sources.map((source) => [source.file, source]));
  const inputs = new Map<string, InputFor>();

  for (const { base, override } of pairComposeFiles(
    sources.map((source) => source.file),
    onWarning
  )) {
    const baseSource = byFile.get(base);
    const overrideSource = byFile.get(override);

    if (baseSource === undefined || overrideSource === undefined) {
      continue;
    }

    const [baseInput, overrideInput] = pairInputs(baseSource, overrideSource);
    inputs.set(base, baseInput);
    inputs.set(override, overrideInput);
  }

  return inputs;
};

/**
 * Runs the Compose rules over every Compose file of a scan and returns each
 * file's findings. A base file and the override Compose loads with it are
 * judged together by the rules that report a missing setting, so those
 * rules see the service Compose runs. A file whose content is not
 * analyzable gets no findings.
 */
export const runComposeFiles = (
  sources: readonly ComposeSource[],
  settings: RuleSettings = {},
  onWarning?: (message: string) => void
): Map<string, Diagnostic[]> => {
  const paired = pairedInputs(sources, onWarning);
  const results = new Map<string, Diagnostic[]>();

  for (const source of sources) {
    const own = ownInput(source);

    results.set(
      source.file,
      isAnalyzableCompose(source.compose.document)
        ? applyRules(
            source.file,
            paired.get(source.file) ?? (() => own),
            settings
          )
        : []
    );
  }

  return results;
};
