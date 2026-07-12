import fs from "node:fs/promises";
import path from "node:path";

import type { ProjectInfo } from "../types/index";

const walk = async (
  dir: string,
  fileList: string[] = []
): Promise<string[]> => {
  const files = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        if (
          file.name === "node_modules" ||
          file.name === ".git" ||
          file.name === ".next" ||
          file.name === "dist" ||
          file.name === ".turbo"
        ) {
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

export const discoverProject = async (
  rootDir: string
): Promise<ProjectInfo> => {
  const allFiles = await walk(rootDir);
  const dockerfiles: string[] = [];
  const composeFiles: string[] = [];
  const dockerignores: string[] = [];

  for (const file of allFiles) {
    const base = path.basename(file).toLowerCase();

    if (base === ".dockerignore") {
      dockerignores.push(path.relative(rootDir, file));
    }

    // Match Dockerfile, Dockerfile.*, *.dockerfile
    if (
      base === "dockerfile" ||
      base.startsWith("dockerfile.") ||
      base.endsWith(".dockerfile")
    ) {
      dockerfiles.push(path.relative(rootDir, file));
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
      composeFiles.push(path.relative(rootDir, file));
    }
  }

  return {
    composeFiles,
    dockerfiles,
    dockerignores,
  };
};
