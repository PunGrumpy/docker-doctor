import fs from "node:fs/promises";
import path from "node:path";

import type { ProjectInfo } from "../types/index";
import { createIgnoreMatcher } from "./ignore";

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

const walk = async (
  dir: string,
  fileList: string[] = []
): Promise<string[]> => {
  const files = await fs.readdir(dir, { withFileTypes: true });
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
        if (PRUNED.has(file.name)) {
          return;
        }
        await walk(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    })
  );
  return fileList;
};

// ProjectInfo paths are the public contract (JSON report `file`, PR-comment
// links, rule helpers that split on "/"), so they are POSIX on every OS.
const toPosixRelative = (rootDir: string, file: string): string =>
  path.relative(rootDir, file).split(path.sep).join("/");

export const discoverProject = async (
  rootDir: string,
  options?: { ignoreFiles?: readonly string[] }
): Promise<ProjectInfo> => {
  const allFiles = await walk(rootDir);
  const dockerfiles: string[] = [];
  const composeFiles: string[] = [];
  const dockerignores: string[] = [];
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
