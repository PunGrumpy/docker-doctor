import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { ProjectInfo } from "../types/index";
import { createIgnoreMatcher, normalizeIgnorePattern } from "./ignore";

// Directories that never contain a user's own Dockerfiles: VCS metadata,
// installed dependencies, caches and build output. `build/`, `out/`,
// `target/` and `vendor/` are deliberately absent. Real Dockerfiles live in
// them often enough that skipping would hide findings; use `ignore.files`.
export const PRUNED_DIRECTORIES = [
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "bower_components",
  ".pnpm-store",
  ".yarn",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".gradle",
  ".turbo",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".parcel-cache",
  ".cache",
  "coverage",
  "dist",
] as const;

const PRUNED = new Set<string>(PRUNED_DIRECTORIES);

// ProjectInfo paths are the public contract (JSON report `file`, PR-comment
// links, rule helpers that split on "/"), so they are POSIX on every OS.
const toPosixRelative = (rootDir: string, file: string): string =>
  path.relative(rootDir, file).split(path.sep).join("/");

const SUBTREE_SUFFIX = "/**";

// A pattern `X/**` ignores every path under a directory that matches `X`,
// so such a directory can be skipped without reading it. Other patterns
// never prune: `examples/*` ignores only the direct children of `examples/`,
// and the files below them must still be found.
const createPrunedDirectoryMatcher = (
  patterns: readonly string[] = []
): ((relativeDir: string) => boolean) =>
  createIgnoreMatcher(
    patterns
      .map(normalizeIgnorePattern)
      .filter((pattern) => pattern.endsWith(SUBTREE_SUFFIX))
      .map((pattern) => pattern.slice(0, -SUBTREE_SUFFIX.length))
  );

interface WalkOptions {
  isPrunedByConfig: (relativeDir: string) => boolean;
  onSkippedDirectory?: (relativeDir: string) => void;
  rootDir: string;
}

const isPermissionError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error.code === "EACCES" || error.code === "EPERM");

const walk = async (
  dir: string,
  options: WalkOptions,
  fileList: string[] = []
): Promise<string[]> => {
  let files: Dirent[];
  try {
    files = await fs.readdir(dir, { withFileTypes: true });
  } catch (error: unknown) {
    // An unreadable subdirectory, such as a root-owned volume directory
    // left by `docker compose up`, is skipped. Errors on the scan root
    // itself still fail the scan.
    if (dir !== options.rootDir && isPermissionError(error)) {
      options.onSkippedDirectory?.(toPosixRelative(options.rootDir, dir));
      return fileList;
    }
    throw error;
  }
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file.name);
      if (file.isSymbolicLink()) {
        // Never traverse a symlinked directory (cycles, trees outside the
        // root). A symlinked file is listed and later read through the link.
        fileList.push(filePath);
        return;
      }
      if (file.isDirectory()) {
        if (
          PRUNED.has(file.name) ||
          options.isPrunedByConfig(toPosixRelative(options.rootDir, filePath))
        ) {
          return;
        }
        await walk(filePath, options, fileList);
      } else {
        fileList.push(filePath);
      }
    })
  );
  return fileList;
};

export const discoverProject = async (
  rootDir: string,
  options?: {
    ignoreFiles?: readonly string[];
    // Called once per subdirectory that could not be read (EACCES/EPERM),
    // with its root-relative POSIX path. The scan continues without it.
    onSkippedDirectory?: (relativeDir: string) => void;
  }
): Promise<ProjectInfo> => {
  const allFiles = await walk(rootDir, {
    isPrunedByConfig: createPrunedDirectoryMatcher(options?.ignoreFiles),
    onSkippedDirectory: options?.onSkippedDirectory,
    rootDir,
  });
  const dockerfiles: string[] = [];
  const composeFiles: string[] = [];
  const dockerignores: string[] = [];
  // Still needed after pruning: file patterns such as `**/compose.yaml`
  // and `examples/*` are only applied here.
  const isIgnored = createIgnoreMatcher(options?.ignoreFiles);

  for (const file of allFiles) {
    const relative = toPosixRelative(rootDir, file);
    if (isIgnored(relative)) {
      continue;
    }
    const base = path.basename(file).toLowerCase();

    if (base.endsWith(".dockerignore")) {
      // `.dockerignore` and BuildKit's per-Dockerfile `<name>.dockerignore`
      // are ignore files, never Dockerfiles — even though the latter also
      // matches the `Dockerfile.*` shape below.
      dockerignores.push(relative);
      continue;
    }

    // Match Dockerfile, Dockerfile.*, *.dockerfile
    if (
      base === "dockerfile" ||
      base.startsWith("dockerfile.") ||
      base.endsWith(".dockerfile")
    ) {
      dockerfiles.push(relative);
    }

    // Match docker-compose.yml, docker-compose.*.yml, compose.yml, compose.*.yml, and yaml extensions
    if (
      base === "docker-compose.yml" ||
      base === "docker-compose.yaml" ||
      base === "compose.yml" ||
      base === "compose.yaml" ||
      ((base.startsWith("docker-compose.") || base.startsWith("compose.")) &&
        (base.endsWith(".yml") || base.endsWith(".yaml")))
    ) {
      composeFiles.push(relative);
    }
  }

  // The traversal is concurrent, so results arrive in I/O-completion order.
  // Sort at the boundary so identical scans produce byte-identical JSON
  // reports and stable PR-comment row ordering. The default comparator is
  // deliberate: localeCompare would make the order machine-dependent, which
  // is the class of bug this sorting exists to fix.
  return {
    composeFiles: composeFiles.toSorted(),
    dockerfiles: dockerfiles.toSorted(),
    dockerignores: dockerignores.toSorted(),
  };
};
