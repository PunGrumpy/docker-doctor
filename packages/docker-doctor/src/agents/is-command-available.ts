import fs from "node:fs";
import path from "node:path";

const WINDOWS_EXTENSIONS = [".exe", ".cmd", ".bat"];

export const isCommandAvailable = (command: string): boolean => {
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? WINDOWS_EXTENSIONS : [""];

  for (const dir of pathValue.split(path.delimiter)) {
    if (dir === "") {
      continue;
    }
    for (const extension of extensions) {
      try {
        fs.accessSync(path.join(dir, command + extension), fs.constants.X_OK);
        return true;
      } catch {
        // Not in this directory — keep looking.
      }
    }
  }
  return false;
};
