import { parseImageRef } from "../parsers/image-ref";
import { hasText } from "../text";
import { applyFoldsAndDefaults } from "./compose-mounts";

const LIBRARY_PREFIX = "library/";

export interface ComposeImage {
  /** `undefined` means the reference names no registry, so Docker Hub. */
  registry: string | undefined;
  /** The name without registry, tag, digest or a leading `library/`. */
  repository: string;
}

/**
 * Reads a Compose `image:` value. A `${VAR:-default}` resolves to its default
 * first. `undefined` means the reference still depends on a variable.
 */
export const parseComposeImage = (image: string): ComposeImage | undefined => {
  const resolved = applyFoldsAndDefaults(image);

  if (!hasText(resolved) || resolved.includes("$")) {
    return undefined;
  }

  const { name, registry } = parseImageRef(resolved);

  return {
    registry,
    repository: name.startsWith(LIBRARY_PREFIX)
      ? name.slice(LIBRARY_PREFIX.length)
      : name,
  };
};
