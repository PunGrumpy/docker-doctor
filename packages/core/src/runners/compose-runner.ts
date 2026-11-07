import { overlayCompose, pairComposeFiles } from "../parsers/compose-overlay";
import type { ComposeFile } from "../parsers/compose-parser";
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

// What one rule reads for one file: the services to judge, and the project
// they belong to when that is more than the file.
interface RuleInput {
  content: ComposeValue;
  project?: ComposeValue;
}

const applyRules = (
  file: string,
  inputFor: (rule: ComposeRule) => RuleInput,
  locate: ComposeLocator | undefined,
  { rulesConfig, categoriesConfig }: RuleSettings
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const rule of allComposeRules) {
    const severity = resolveSeverity(rule, rulesConfig, categoriesConfig);

    if (severity === "off") {
      continue;
    }

    const { content, project } = inputFor(rule);
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

  return applyRules(file, () => ({ content: composeContent }), locate, {
    categoriesConfig,
    rulesConfig,
  });
};

// The rules that report a setting a service lacks. Compose runs a base file
// merged with its override, so these judge the merged service. Every other
// Compose rule reports a risky line and judges each file on its own.
const EFFECTIVE_SERVICE_RULES: ReadonlySet<ComposeRule> = new Set([
  requireResourceLimits,
  requireRestartPolicy,
  undefinedModelReference,
]);

/** One parsed Compose file of a scan. */
export interface ComposeSource {
  file: string;
  compose: ComposeFile;
  locate?: ComposeLocator;
}

const servicesNamed = (
  project: ComposeValue,
  keep: (name: string) => boolean
): ComposeValue => ({
  services: Object.fromEntries(
    composeServices(project).filter(([name]) => keep(name))
  ),
});

// For each paired file, the merged services it answers for. The base answers
// for every service it defines, because that is where a user adds a missing
// setting. The override answers for the services only it defines.
const effectiveInputs = (
  sources: readonly ComposeSource[],
  onWarning?: (message: string) => void
): Map<string, RuleInput> => {
  const byFile = new Map(sources.map((source) => [source.file, source]));
  const inputs = new Map<string, RuleInput>();

  for (const { base, override } of pairComposeFiles(
    sources.map((source) => source.file),
    onWarning
  )) {
    const baseSource = byFile.get(base);
    const overrideSource = byFile.get(override);

    if (baseSource === undefined || overrideSource === undefined) {
      continue;
    }

    const project = overlayCompose(baseSource.compose, overrideSource.compose);

    const inBase = new Set<string>(
      composeServices(baseSource.compose.document).map(([name]) => name)
    );

    inputs.set(base, {
      content: servicesNamed(project, (name) => inBase.has(name)),
      project,
    });
    inputs.set(override, {
      content: servicesNamed(project, (name) => !inBase.has(name)),
      project,
    });
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
  const effective = effectiveInputs(sources, onWarning);
  const results = new Map<string, Diagnostic[]>();

  for (const { file, compose, locate } of sources) {
    const own: RuleInput = { content: compose.document };
    const merged = effective.get(file);

    results.set(
      file,
      isAnalyzableCompose(compose.document)
        ? applyRules(
            file,
            (rule) =>
              merged !== undefined && EFFECTIVE_SERVICE_RULES.has(rule)
                ? merged
                : own,
            locate,
            settings
          )
        : []
    );
  }

  return results;
};
