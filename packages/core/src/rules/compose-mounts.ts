import path from "node:path";

/**
 * Shared parsing for Compose `volumes:` entries, used by every rule that
 * reasons about bind mounts. A Compose volume entry is either the short
 * `[SOURCE:]TARGET[:MODE]` string or the long-syntax object; both collapse
 * to a `VolumeMount`.
 */

// `${VAR:-default}` resolves to its default; `${VAR}`, `$VAR` and the
// `?error` forms resolve to nothing.
const INTERPOLATION_WITH_DEFAULT = /\$\{[^}:?-]+:?-(?<fallback>[^}]*)\}/gu;
const INTERPOLATION_WITHOUT_DEFAULT = /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/gu;
// `$HOME` and `${HOME}` name the same directory `~` does; fold them before
// the generic interpolation pass would erase them.
const HOME_INTERPOLATION = /\$\{HOME\}|\$HOME(?![A-Za-z0-9_])/gu;

export const resolveInterpolationDefaults = (value: string): string =>
  value
    .replace(HOME_INTERPOLATION, "~")
    .replace(INTERPOLATION_WITH_DEFAULT, (_match, fallback: string) => fallback)
    .replace(INTERPOLATION_WITHOUT_DEFAULT, "");

// Named volumes cannot start with a path prefix, so only path-shaped
// sources are bind mounts.
export const PATH_SHAPED = /^(?:[/.~]|[A-Za-z]:)/u;

// `[SOURCE:]TARGET[:MODE]`, where a `${VAR:-default}` source has its own colon.
const splitShortSyntax = (spec: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of spec) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    }
    if (char === ":" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
};

// Windows drive-letter paths also carry a colon; `C:\data:/data` splits into
// `C`, `\data`, `/data`, so re-join a lone drive letter with what follows.
const DRIVE_LETTER = /^[A-Za-z]$/u;

const joinDriveLetter = (parts: string[]): string[] => {
  const [first, second, ...rest] = parts;
  if (
    first !== undefined &&
    second !== undefined &&
    DRIVE_LETTER.test(first) &&
    /^[\\/]/u.test(second)
  ) {
    return [`${first}:${second}`, ...rest];
  }
  return parts;
};

export interface VolumeMount {
  source: string | undefined;
  target: string | undefined;
  /** `:ro` in the short syntax, `read_only: true` in the long syntax. */
  readOnly: boolean;
  /** Long-syntax `type`; the short syntax leaves it undefined. */
  type: string | undefined;
}

const shortSyntaxReadOnly = (mode: string | undefined): boolean =>
  mode !== undefined && mode.split(",").includes("ro");

export const volumeMount = (volume: unknown): VolumeMount | undefined => {
  if (typeof volume === "string") {
    const [source, target, mode] = joinDriveLetter(splitShortSyntax(volume));
    // A lone path is an anonymous volume at that target, not a bind mount.
    if (target === undefined) {
      return undefined;
    }
    return {
      readOnly: shortSyntaxReadOnly(mode),
      source,
      target,
      type: undefined,
    };
  }
  if (volume && typeof volume === "object") {
    const {
      read_only: readOnly,
      source,
      target,
      type,
    } = volume as Record<string, unknown>;
    return {
      readOnly: readOnly === true,
      source: typeof source === "string" ? source : undefined,
      target: typeof target === "string" ? target : undefined,
      type: typeof type === "string" ? type : undefined,
    };
  }
  return undefined;
};

/**
 * The host path a bind mount reads from, with interpolation defaults
 * applied and Windows separators folded to `/`. Undefined when the entry is
 * not a bind mount (named volume, tmpfs, anonymous volume) or when the
 * source is an interpolation with no default, which names no host path.
 */
export const bindMountSource = (mount: VolumeMount): string | undefined => {
  if (mount.type !== undefined && mount.type !== "bind") {
    return undefined;
  }
  if (!mount.source) {
    return undefined;
  }
  const resolved = resolveInterpolationDefaults(mount.source).replaceAll(
    "\\",
    "/"
  );
  if (resolved === "" || !PATH_SHAPED.test(resolved)) {
    return undefined;
  }
  return resolved;
};

const isDockerSocketPath = (hostPath: string): boolean =>
  hostPath.endsWith("/docker.sock") || hostPath.endsWith("/pipe/docker_engine");

const DOCKER_SOCKET_TARGET = "/var/run/docker.sock";

/**
 * Whether the entry bind-mounts the Docker socket, under any of its host
 * spellings. A bare `${VAR}` source names no host path, but a socket target
 * still tells the story.
 */
export const mountsDockerSocket = (mount: VolumeMount): boolean => {
  const source = bindMountSource(mount);
  if (source !== undefined) {
    return isDockerSocketPath(source);
  }
  if (mount.type !== undefined && mount.type !== "bind") {
    return false;
  }
  if (!mount.source) {
    return false;
  }
  return (
    resolveInterpolationDefaults(mount.source) === "" &&
    resolveInterpolationDefaults(mount.target ?? "") === DOCKER_SOCKET_TARGET
  );
};

const WINDOWS_DRIVE_ROOT = /^[A-Za-z]:\/?$/u;
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/u;

export type HostPathScope =
  | "project"
  | "parent"
  | "home"
  | "home-dotfile"
  | "root"
  | "system"
  | "host";

// Absolute directories that hold host configuration, credentials, process
// state, or the kernel's own interfaces. A container that can see them can
// read more than the service it runs.
const SYSTEM_DIRECTORIES = [
  "/etc",
  "/root",
  "/home",
  "/Users",
  "/proc",
  "/sys",
  "/boot",
  "/run",
  "/var/run",
] as const;

const startsWithDirectory = (hostPath: string, directory: string): boolean =>
  hostPath === directory || hostPath.startsWith(`${directory}/`);

/**
 * Classifies where on the host a bind-mount source points. `project` is a
 * relative path that stays inside the Compose project directory; everything
 * else reaches outside it.
 */
export const classifyHostPath = (hostPath: string): HostPathScope => {
  const collapsed = path.posix.normalize(hostPath);
  const normalized =
    collapsed.length > 1 ? collapsed.replace(/\/+$/u, "") : collapsed;

  if (normalized === "~") {
    return "home";
  }
  if (normalized.startsWith("~/")) {
    return normalized.startsWith("~/.") ? "home-dotfile" : "host";
  }
  if (normalized === "." || normalized.startsWith("./")) {
    return "project";
  }
  if (normalized === ".." || normalized.startsWith("../")) {
    return "parent";
  }
  if (WINDOWS_DRIVE_ROOT.test(normalized)) {
    return "root";
  }
  if (WINDOWS_DRIVE_PREFIX.test(normalized)) {
    return "host";
  }
  if (normalized === "/") {
    return "root";
  }
  if (!normalized.startsWith("/")) {
    // `path.posix.normalize("./src")` yields `src`.
    return "project";
  }
  for (const directory of SYSTEM_DIRECTORIES) {
    if (startsWithDirectory(normalized, directory)) {
      return "system";
    }
  }
  return "host";
};
