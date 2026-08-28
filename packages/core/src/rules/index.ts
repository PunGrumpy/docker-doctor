import type {
  DockerfileRule,
  ComposeRule,
  RuleDefinition,
} from "../types/index";
import { bestPracticesRules } from "./best-practices";
import { composeRules } from "./compose";
import { composeSecurityRules } from "./compose-security";
import { imageSizeRules } from "./image-size";
import { performanceRules } from "./performance";
import { securityRules } from "./security";

export const allDockerfileRules: DockerfileRule[] = [
  ...securityRules,
  ...performanceRules,
  ...bestPracticesRules,
  ...imageSizeRules,
];

export const allComposeRules: ComposeRule[] = [
  ...composeRules,
  ...composeSecurityRules,
];

export const allRules: RuleDefinition[] = [
  ...allDockerfileRules,
  ...allComposeRules,
];

export const findRule = (key: string): RuleDefinition | undefined =>
  allRules.find((rule) => rule.key === key);
