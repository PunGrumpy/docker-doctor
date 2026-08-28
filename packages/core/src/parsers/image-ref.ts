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

/**
 * Docker Hardened Images (free catalog since Dec 2025) are pulled from the
 * dhi.io registry. Enterprise mirrors live under a plain Docker Hub org
 * namespace and cannot be recognized from the ref alone, so they keep the
 * default rule behavior.
 */
export const isHardenedImage = (imagePart: string): boolean =>
  imagePart.toLowerCase().startsWith("dhi.io/");

/**
 * DHI runtime variants ship no shell or package manager and run as a
 * nonroot user by default. The `-dev` variants keep a shell for build
 * stages and are not assumed to be nonroot.
 */
export const isHardenedRuntimeImage = (imagePart: string): boolean => {
  if (!isHardenedImage(imagePart)) {
    return false;
  }
  const { tag } = parseImageRef(imagePart);
  return !(tag === "dev" || tag?.endsWith("-dev"));
};

/**
 * Why a reference would resolve differently over time: no tag at all, or
 * the mutable `latest` tag without a digest. `undefined` means the ref is
 * pinned. Shared by every pinning rule (base images, service images,
 * models) so they agree on what counts as pinned.
 */
export const mutableRefIssue = (
  ref: ImageRef
): "untagged" | "latest" | undefined => {
  if (!(ref.tag || ref.digest)) {
    return "untagged";
  }
  if (ref.tag === "latest" && !ref.digest) {
    return "latest";
  }
  return undefined;
};

export interface FromArgs {
  base: string | null;
  stage: string | null;
}

// FROM [--flags] <image|stage> [AS <stage>], flags in any position.
export const parseFromArgs = (args: string): FromArgs => {
  const parts = args.split(/\s+/u).filter(Boolean);
  const asIndex = parts.findIndex((p) => p.toLowerCase() === "as");
  const imageParts = asIndex === -1 ? parts : parts.slice(0, asIndex);
  return {
    base: imageParts.find((p) => !p.startsWith("--")) ?? null,
    stage: asIndex === -1 ? null : (parts[asIndex + 1] ?? null),
  };
};

// The reserved empty base, not a real image: nothing to pin a tag on, no
// distribution to slim down, and no image config to inherit. One definition
// so the rules cannot disagree about a given FROM line.
export const isScratch = (base: string | null): boolean =>
  base?.toLowerCase() === "scratch";

export const collectStageAliases = (
  instructions: DockerfileInstruction[]
): Set<string> => {
  const aliases = new Set<string>();

  for (const inst of instructions) {
    if (inst.instruction !== "FROM") {
      continue;
    }

    const { stage } = parseFromArgs(inst.args);
    if (stage) {
      aliases.add(stage.toLowerCase());
    }
  }

  return aliases;
};
