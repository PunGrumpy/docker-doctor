import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scaffoldActionWorkflow } from "../src/workflow-scaffold";

const ACTION_REF = "PunGrumpy/docker-doctor@v1";
const WORKFLOW_PATH = ".github/workflows/docker-doctor.yml";
const EXISTING_CONTENT = "# my customized workflow\n";

const makeProject = (options: { withWorkflow: boolean }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dd-scaffold-"));
  if (options.withWorkflow) {
    fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(root, WORKFLOW_PATH), EXISTING_CONTENT);
  }
  return {
    cleanup: () => fs.rmSync(root, { force: true, recursive: true }),
    read: () => fs.readFileSync(path.join(root, WORKFLOW_PATH), "utf-8"),
    root,
  };
};

const neverCalled = () => {
  throw new Error("confirmOverwrite must not be called when no file exists");
};

describe("scaffoldActionWorkflow", () => {
  test("creates the workflow under the scanned root, not the cwd", async () => {
    const { root, read, cleanup } = makeProject({ withWorkflow: false });
    // Snapshot, don't assert absence — the repo root legitimately owns
    // .github/workflows/docker-doctor.yml when the runner starts there.
    const cwdWorkflow = path.join(process.cwd(), WORKFLOW_PATH);
    const cwdWorkflowBefore = fs.existsSync(cwdWorkflow)
      ? fs.readFileSync(cwdWorkflow, "utf-8")
      : null;
    try {
      const status = await scaffoldActionWorkflow({
        actionRef: ACTION_REF,
        confirmOverwrite: neverCalled,
        rootDir: root,
      });

      expect(status).toBe("created");
      expect(read()).toContain("name: Docker Doctor");
      expect(read()).toContain(`uses: ${ACTION_REF}`);
      const cwdWorkflowAfter = fs.existsSync(cwdWorkflow)
        ? fs.readFileSync(cwdWorkflow, "utf-8")
        : null;
      expect(cwdWorkflowAfter).toBe(cwdWorkflowBefore);
    } finally {
      cleanup();
    }
  });

  test("keeps an existing workflow when the overwrite is declined", async () => {
    const { root, read, cleanup } = makeProject({ withWorkflow: true });
    try {
      const status = await scaffoldActionWorkflow({
        actionRef: ACTION_REF,
        confirmOverwrite: () => Promise.resolve(false),
        rootDir: root,
      });

      expect(status).toBe("kept");
      expect(read()).toBe(EXISTING_CONTENT);
    } finally {
      cleanup();
    }
  });

  test("replaces an existing workflow only when the overwrite is confirmed", async () => {
    const { root, read, cleanup } = makeProject({ withWorkflow: true });
    try {
      const status = await scaffoldActionWorkflow({
        actionRef: ACTION_REF,
        confirmOverwrite: () => Promise.resolve(true),
        rootDir: root,
      });

      expect(status).toBe("updated");
      expect(read()).toContain("name: Docker Doctor");
      expect(read()).not.toContain("my customized workflow");
    } finally {
      cleanup();
    }
  });
});
