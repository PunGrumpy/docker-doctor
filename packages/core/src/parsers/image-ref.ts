import type { DockerfileInstruction } from "../types/index";

export interface ImageRef {
  registry?: string;
  name: string;
  tag?: string;
  digest?: string;
  isVariable: boolean;
}

export const parseImageRef = (ref: string): ImageRef => {
  if (ref.includes("${") || ref.startsWith("$")) {
    return { isVariable: true, name: ref };
  }

  let remainder = ref;
  let digest: string | undefined;

  const atIndex = remainder.indexOf("@");
  if (atIndex !== -1) {
    digest = remainder.slice(atIndex + 1);
    remainder = remainder.slice(0, atIndex);
  }

  let tag: string | undefined;
  const lastColonIndex = remainder.lastIndexOf(":");
  const lastSlashIndex = remainder.lastIndexOf("/");

  if (lastColonIndex !== -1 && lastColonIndex > lastSlashIndex) {
    tag = remainder.slice(lastColonIndex + 1);
    remainder = remainder.slice(0, lastColonIndex);
  }

  let registry: string | undefined;
  const firstSlashIndex = remainder.indexOf("/");
  if (firstSlashIndex !== -1) {
    const firstSegment = remainder.slice(0, firstSlashIndex);
    if (
      firstSegment.includes(".") ||
      firstSegment.includes(":") ||
      firstSegment === "localhost"
    ) {
      registry = firstSegment;
      remainder = remainder.slice(firstSlashIndex + 1);
    }
  }

  return {
    digest,
    isVariable: false,
    name: remainder,
    registry,
    tag,
  };
};

export const collectStageAliases = (
  instructions: DockerfileInstruction[]
): Set<string> => {
  const aliases = new Set<string>();

  for (const inst of instructions) {
    if (inst.instruction !== "FROM") {
      continue;
    }

    const match = /\sas\s+(?<alias>\S+)/iu.exec(inst.args);
    if (match?.groups?.alias) {
      aliases.add(match.groups.alias.toLowerCase());
    }
  }

  return aliases;
};
