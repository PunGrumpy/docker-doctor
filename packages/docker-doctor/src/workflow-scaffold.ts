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

// Writes the PR workflow into the directory that was scanned -- not the process
// cwd, which need not even be the same repository -- and never replaces an
// existing workflow without consent. confirmOverwrite is injected so the caller
// owns the prompt (and so this is testable without a TTY).
export const scaffoldActionWorkflow = async (options: {
  actionRef: string;
  confirmOverwrite: () => Promise<boolean>;
  rootDir: string;
}): Promise<ScaffoldStatus> => {
  const workflowDir = path.join(options.rootDir, ".github", "workflows");
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
jobs:
  docker-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: ${options.actionRef}
`;

  await fs.mkdir(workflowDir, { recursive: true });
  await fs.writeFile(workflowPath, workflowYaml, "utf-8");
  return existing ? "updated" : "created";
};
