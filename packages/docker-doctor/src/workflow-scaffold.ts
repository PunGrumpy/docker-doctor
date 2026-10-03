import fs from "node:fs/promises";
import path from "node:path";

export const WORKFLOW_RELATIVE_PATH = ".github/workflows/docker-doctor.yml";

export type ScaffoldStatus = "created" | "kept" | "updated";

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// `dir` and each of its ancestors, nearest first.
const selfAndAncestors = (dir: string): string[] => {
  const dirs = [dir];
  let parent = path.dirname(dir);
  while (parent !== dirs.at(-1)) {
    dirs.push(parent);
    parent = path.dirname(parent);
  }
  return dirs;
};

// The root of the repository that contains `dir`, which is the nearest
// directory with a `.git` entry. `.git` is a directory in a normal clone and
// a file in a worktree or submodule. Null when `dir` is not inside a
// repository.
const findRepositoryRoot = async (dir: string): Promise<string | null> => {
  const candidates = selfAndAncestors(dir);
  const hasGit = await Promise.all(
    candidates.map((candidate) => fileExists(path.join(candidate, ".git")))
  );
  const nearest = hasGit.indexOf(true);
  return nearest === -1 ? null : candidates[nearest];
};

// Writes the PR workflow for the scanned directory, not the process cwd,
// which can be a different repository. It never replaces an existing
// workflow without consent. GitHub only runs workflows from the repository
// root, so a scan of a subdirectory writes the workflow at that root and
// passes the subdirectory as the action's `directory` input.
// confirmOverwrite is injected so the caller owns the prompt and the
// function is testable without a TTY.
export const scaffoldActionWorkflow = async (options: {
  actionRef: string;
  confirmOverwrite: () => Promise<boolean>;
  rootDir: string;
}): Promise<ScaffoldStatus> => {
  const repositoryRoot =
    (await findRepositoryRoot(options.rootDir)) ?? options.rootDir;
  const scanDirectory = path
    .relative(repositoryRoot, options.rootDir)
    .split(path.sep)
    .join("/");
  // A JSON string is a valid YAML double-quoted scalar, whatever the path
  // contains.
  const directoryInput =
    scanDirectory === ""
      ? ""
      : `        with:\n          directory: ${JSON.stringify(scanDirectory)}\n`;
  const workflowDir = path.join(repositoryRoot, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "docker-doctor.yml");
  const existing = await fileExists(workflowPath);

  if (existing && !(await options.confirmOverwrite())) {
    return "kept";
  }

  const workflowYaml = `name: Docker Doctor
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
  issues: write
  statuses: write
jobs:
  docker-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: ${options.actionRef}
${directoryInput}`;

  await fs.mkdir(workflowDir, { recursive: true });
  await fs.writeFile(workflowPath, workflowYaml, "utf-8");
  return existing ? "updated" : "created";
};
