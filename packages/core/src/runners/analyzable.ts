import { isComposeMapping } from "../parsers/compose-value";
import { topLevelModels } from "../rules/compose-models";
import { composeServices } from "../rules/compose-services";
import type { ComposeValue, DockerfileInstruction } from "../types/index";

// The score averages the penalty over the files the rules could check. A
// file with nothing to check (empty, comment-only, a stub) has no findings
// by design, so counting it would pull the average toward 100.

export const isAnalyzableDockerfile = (
  instructions: DockerfileInstruction[]
): boolean => instructions.length > 0;

// The Compose rules read `services`, the top-level `models` and the
// `version` key. A document with none of them, or one that is not a
// mapping, gives them nothing to check.
export const isAnalyzableCompose = (composeContent: ComposeValue): boolean => {
  if (!isComposeMapping(composeContent)) {
    return false;
  }

  return (
    composeServices(composeContent).length > 0 ||
    Object.keys(topLevelModels(composeContent)).length > 0 ||
    "version" in composeContent
  );
};
