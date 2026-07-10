import type {
  DockerfileRule,
  ComposeRule,
  RuleDefinition,
} from "../types/index.js";
import { bestPracticesRules } from "./best-practices.js";
import { composeRules } from "./compose.js";
import { imageSizeRules } from "./image-size.js";
import { performanceRules } from "./performance.js";
import { securityRules } from "./security.js";

export const allDockerfileRules: DockerfileRule[] = [
  ...securityRules,
  ...performanceRules,
  ...bestPracticesRules,
  ...imageSizeRules,
];

export const allComposeRules: ComposeRule[] = [...composeRules];

export const allRules: RuleDefinition[] = [
  ...allDockerfileRules,
  ...allComposeRules,
];

export const findRule = (key: string): RuleDefinition | undefined =>
  allRules.find((rule) => rule.key === key);
