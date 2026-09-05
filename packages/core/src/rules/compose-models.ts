import { mutableRefIssue, parseImageRef } from "../parsers/image-ref";
import type { ComposeRule, Diagnostic } from "../types/index";
import { composeServices } from "./compose-services";
import { createDiagnostic } from "./create-diagnostic";

/**
 * Narrows an unknown compose document to its top-level `models:` entries
 * (Docker Model Runner, Compose ≥ 2.35).
 */
const topLevelModels = (composeContent: unknown): Record<string, unknown> => {
  if (
    !composeContent ||
    typeof composeContent !== "object" ||
    !("models" in composeContent)
  ) {
    return {};
  }
  const { models } = composeContent as { models?: unknown };
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return {};
  }
  return models as Record<string, unknown>;
};

export const undefinedModelReference: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];
    const defined = new Set(Object.keys(topLevelModels(composeContent)));

    const flag = (
      serviceName: string,
      modelName: string,
      pathTail: string | number
    ) => {
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          `Service '${serviceName}' references model '${modelName}', which is not declared in the top-level models section. Compose cannot resolve it.`,
          this.help,
          context?.locate?.(["services", serviceName, "models", pathTail])
        )
      );
    };

    for (const [name, config] of composeServices(composeContent)) {
      const { models } = config;
      if (Array.isArray(models)) {
        // Short syntax: a list of model names.
        for (const [index, entry] of models.entries()) {
          if (typeof entry === "string" && !defined.has(entry)) {
            flag(name, entry, index);
          }
        }
      } else if (models && typeof models === "object") {
        // Long syntax: a map of model name → binding config.
        for (const modelName of Object.keys(models)) {
          if (!defined.has(modelName)) {
            flag(name, modelName, modelName);
          }
        }
      }
    }

    return diagnostics;
  },
  defaultSeverity: "error",
  help: "Every name under a service's `models:` must match an entry in the top-level `models:` element. Declare the model there (with its `model:` OCI artifact) or fix the reference.",
  key: "docker-doctor/undefined-model-reference",
  message: "Service model references must be declared in top-level models",
};

interface ModelBinding {
  subject: string;
  model: string;
  path: (string | number)[];
}

// Top-level `models:` (Compose ≥ 2.38) plus the older service-level
// `provider: { type: model }` form (Compose ≥ 2.35).
const collectModelBindings = (composeContent: unknown): ModelBinding[] => {
  const bindings: ModelBinding[] = [];

  for (const [name, config] of Object.entries(topLevelModels(composeContent))) {
    if (!config || typeof config !== "object") {
      continue;
    }
    const { model } = config as Record<string, unknown>;
    if (typeof model === "string") {
      bindings.push({
        model,
        path: ["models", name, "model"],
        subject: `Model '${name}' artifact`,
      });
    }
  }

  for (const [name, config] of composeServices(composeContent)) {
    const { provider } = config;
    if (!provider || typeof provider !== "object") {
      continue;
    }
    const { type, options } = provider as Record<string, unknown>;
    if (type !== "model" || !options || typeof options !== "object") {
      continue;
    }
    const { model } = options as Record<string, unknown>;
    if (typeof model === "string") {
      bindings.push({
        model,
        path: ["services", name, "provider", "options", "model"],
        subject: `Service '${name}' model provider`,
      });
    }
  }

  return bindings;
};

export const pinModelVersion: ComposeRule = {
  category: "Compose",
  check(composeContent, file, context) {
    const diagnostics: Diagnostic[] = [];

    for (const { subject, model, path } of collectModelBindings(
      composeContent
    )) {
      const ref = parseImageRef(model);
      if (ref.isVariable) {
        continue;
      }

      const issue = mutableRefIssue(ref);
      if (!issue) {
        continue;
      }
      const detail =
        issue === "untagged"
          ? `${subject} '${model}' does not specify a tag.`
          : `${subject} '${model}' uses the mutable 'latest' tag.`;
      diagnostics.push(
        createDiagnostic(
          file,
          this.key,
          this.defaultSeverity,
          `${detail} Every pull may fetch different weights.`,
          this.help,
          context?.locate?.(path)
        )
      );
    }

    return diagnostics;
  },
  defaultSeverity: "warning",
  help: "Pin the model to a specific tag (e.g. `ai/gemma3:4B-Q4_0`) so every environment runs the same weights. Model behavior differences are far harder to debug than software version drift.",
  key: "docker-doctor/pin-model-version",
  message: "Pin models to a specific tag or digest",
};

export const composeModelRules = [undefinedModelReference, pinModelVersion];
