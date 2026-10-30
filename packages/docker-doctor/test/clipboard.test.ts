import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { copyToClipboard } from "../src/agents/clipboard";

// The published CLI runs under Node. Bun survives a failed write to a closed
// pipe and Node throws it as an uncaught error, so the tests below run
// clipboard.ts under Node. Node 22.18 and later strip the types, which works
// as long as the file imports only built-in modules.
const NODE = Bun.which("node") ?? "node";

const CLIPBOARD_MODULE = new URL("../src/agents/clipboard.ts", import.meta.url)
  .href;

// Larger than a pipe buffer, so the write cannot finish before the tool exits.
const PAYLOAD_BYTES = 1024 * 1024;

const DRIVER = `
const { copyToClipboard } = await import(process.env.CLIPBOARD_MODULE);
const copied = await copyToClipboard("x".repeat(${PAYLOAD_BYTES}));
console.log(JSON.stringify(copied));
`;

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

  const copyUnderNode = () => {
    const result = spawnSync(NODE, ["--input-type=module", "--eval", DRIVER], {
      encoding: "utf-8",
      env: { CLIPBOARD_MODULE, PATH: bin },
    });

    return { status: result.status, stdout: result.stdout.trim() };
  };

  test("under Node, a tool that exits without reading is a failed copy", () => {
    installTool("wl-copy", "exit 1");

    expect(copyUnderNode()).toEqual({ status: 0, stdout: "false" });
  });

  test("under Node, falls through to the next tool after one exits without reading", () => {
    const copied = path.join(bin, "copied.txt");
    installTool("wl-copy", "exit 1");
    installTool("xclip", `/bin/cat > "${copied}"`);

    expect(copyUnderNode()).toEqual({ status: 0, stdout: "true" });
    expect(fs.statSync(copied).size).toBe(PAYLOAD_BYTES);
  });
});
