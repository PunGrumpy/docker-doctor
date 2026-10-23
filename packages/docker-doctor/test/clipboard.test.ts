import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { copyToClipboard } from "../src/agents/clipboard";

// On Linux the clipboard tools are tried in order: wl-copy, xclip, xsel.
describe.skipIf(process.platform !== "linux")("copyToClipboard", () => {
  let bin: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    bin = fs.mkdtempSync(path.join(os.tmpdir(), "dd-clipboard-bin-"));
    originalPath = process.env.PATH;
    process.env.PATH = bin;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    fs.rmSync(bin, { force: true, recursive: true });
  });

  const installTool = (name: string, script: string): void => {
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${script}\n`, {
      mode: 0o755,
    });
  };

  test("pipes the text to the first tool that succeeds", async () => {
    const copied = path.join(bin, "copied.txt");
    installTool("wl-copy", "exit 1");
    installTool(
      "xclip",
      `IFS= read -r line; printf "%s" "$line" > "${copied}"`
    );

    expect(await copyToClipboard("fix it")).toBe(true);
    expect(fs.readFileSync(copied, "utf-8")).toBe("fix it");
  });

  test("resolves false when every tool fails or is missing", async () => {
    installTool("xsel", "exit 1");

    expect(await copyToClipboard("fix it")).toBe(false);
  });
});
