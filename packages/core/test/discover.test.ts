import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { discoverProject } from "../src/project-info/discover";
import { createIgnoreMatcher } from "../src/project-info/ignore";

// Enough breadth and depth that a concurrent walk interleaves subtrees.
const DIRS = [
  "zeta",
  "alpha/nested",
  "mid",
  "beta/deep/deeper",
  "gamma",
  "delta",
  "epsilon/inner",
  "omega",
];

const makeProject = (): { root: string; cleanup: () => void } => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-discover-"));
  for (const dir of DIRS) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(
      path.join(root, dir, "Dockerfile"),
      "FROM node:22-alpine\n"
    );
    fs.writeFileSync(
      path.join(root, dir, "compose.yaml"),
      "services:\n  web:\n    image: nginx:1.27\n"
    );
    fs.writeFileSync(path.join(root, dir, ".dockerignore"), "node_modules\n");
  }
  return {
    cleanup: () => fs.rmSync(root, { force: true, recursive: true }),
    root,
  };
};

describe("discoverProject", () => {
  test("returns each file list in sorted order", async () => {
    const { root, cleanup } = makeProject();
    try {
      const project = await discoverProject(root);

      const dockerignores = project.dockerignores ?? [];

      expect(project.dockerfiles).toEqual(project.dockerfiles.toSorted());
      expect(project.composeFiles).toEqual(project.composeFiles.toSorted());
      expect(dockerignores).toEqual(dockerignores.toSorted());
      expect(project.dockerfiles).toHaveLength(DIRS.length);
    } finally {
      cleanup();
    }
  });

  test("repeated scans of an unchanged project are identical", async () => {
    const { root, cleanup } = makeProject();
    try {
      const first = await discoverProject(root);
      const second = await discoverProject(root);

      expect(second).toEqual(first);
    } finally {
      cleanup();
    }
  });

  test("ignoreFiles excludes matches from every file list", async () => {
    const { root, cleanup } = makeProject();
    try {
      const project = await discoverProject(root, {
        ignoreFiles: ["alpha/**", "**/compose.yaml"],
      });

      expect(project.dockerfiles.some((f) => f.startsWith("alpha/"))).toBe(
        false
      );
      expect(project.dockerfiles).toHaveLength(DIRS.length - 1);
      expect(project.composeFiles).toEqual([]);
      expect(
        (project.dockerignores ?? []).some((f) => f.startsWith("alpha/"))
      ).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe("createIgnoreMatcher", () => {
  test("supports the documented glob subset", () => {
    const matches = createIgnoreMatcher([
      "examples/**/Dockerfile",
      "*.dockerfile",
      "services/?/compose.yml",
    ]);

    expect(matches("examples/Dockerfile")).toBe(true);
    expect(matches("examples/a/b/Dockerfile")).toBe(true);
    expect(matches("other/Dockerfile")).toBe(false);
    expect(matches("api.dockerfile")).toBe(true);
    // `*` stays within one path segment.
    expect(matches("nested/api.dockerfile")).toBe(false);
    expect(matches("services/a/compose.yml")).toBe(true);
    expect(matches("services/ab/compose.yml")).toBe(false);
  });

  test("no patterns matches nothing", () => {
    expect(createIgnoreMatcher()("Dockerfile")).toBe(false);
    expect(createIgnoreMatcher([])("Dockerfile")).toBe(false);
  });
});
