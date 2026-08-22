import fs from "node:fs/promises";
import path from "node:path";

export const WORKFLOW_RELATIVE_PATH = ".github/workflows/docker-doctor.yml";

export type ScaffoldStatus = "created" | "kept" | "updated";

export interface ScaffoldResult {
  path: string;
  status: ScaffoldStatus;
}

const buildWorkflowYaml = (actionRef: string): string => `name: Docker Doctor
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
      - uses: ${actionRef}
`;

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.stat(filePath);
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
}): Promise<ScaffoldResult> => {
  const workflowDir = path.join(options.rootDir, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "docker-doctor.yml");
  const existing = await fileExists(workflowPath);

  if (existing && !(await options.confirmOverwrite())) {
    return { path: workflowPath, status: "kept" };
  }

  await fs.mkdir(workflowDir, { recursive: true });
  await fs.writeFile(
    workflowPath,
    buildWorkflowYaml(options.actionRef),
    "utf-8"
  );
  return { path: workflowPath, status: existing ? "updated" : "created" };
};
