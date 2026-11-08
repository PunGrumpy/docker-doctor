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

// The rules that report a setting a service lacks. Compose runs a base file
// merged with its override, so these judge the merged service.
const EFFECTIVE_SERVICE_RULES: ReadonlySet<ComposeRule> = new Set([
  requireResourceLimits,
  requireRestartPolicy,
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

// What each rule reads for one file of a pair. `answersFor` names the merged
// services whose missing settings this file reports.
const pairedInput =
  (
    source: ComposeSource,
    project: ComposeValue,
    answersFor: (name: string) => boolean
  ): InputFor =>
  (rule) => {
    if (EFFECTIVE_SERVICE_RULES.has(rule)) {
      return {
        content: servicesNamed(project, answersFor),
        locate: source.locate,
        project,
      };
    }

    if (PROJECT_LOOKUP_RULES.has(rule)) {
      return { ...ownInput(source), project };
    }

    return ownInput(source);
  };

// What each rule reads for each paired file. The base answers for the
// missing settings of every service it defines, because that is where a
// user adds one. The override answers for the services only it defines.
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

    const project = overlayCompose(baseSource.compose, overrideSource.compose);

    const inBase = new Set<string>(
      composeServices(baseSource.compose.document).map(([name]) => name)
    );

    inputs.set(
      base,
      pairedInput(baseSource, project, (name) => inBase.has(name))
    );
    inputs.set(
      override,
      pairedInput(overrideSource, project, (name) => !inBase.has(name))
    );
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
