import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isCommandAvailable } from "../src/agents/is-command-available";

describe.skipIf(process.platform === "win32")("isCommandAvailable", () => {
  let bin: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    bin = fs.mkdtempSync(path.join(os.tmpdir(), "dd-command-bin-"));
    originalPath = process.env.PATH;
    process.env.PATH = `${path.delimiter}${bin}`;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { force: true, recursive: true });
  });

  test("finds an executable file on PATH", () => {
    fs.writeFileSync(path.join(bin, "agent"), "#!/bin/sh\n", { mode: 0o755 });

    expect(isCommandAvailable("agent")).toBe(true);
  });

  test("skips a file that is not executable", () => {
    fs.writeFileSync(path.join(bin, "agent"), "#!/bin/sh\n", { mode: 0o644 });

    expect(isCommandAvailable("agent")).toBe(false);
  });

  test("returns false when no PATH directory has the command", () => {
    expect(isCommandAvailable("agent")).toBe(false);
  });
});
