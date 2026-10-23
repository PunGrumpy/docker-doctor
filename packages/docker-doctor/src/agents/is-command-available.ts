import fs from "node:fs";
import path from "node:path";

const WINDOWS_EXTENSIONS = [".exe", ".cmd", ".bat"];

const isExecutableFile = (filePath: string): boolean => {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);

    return true;
  } catch {
    return false;
  }
};

export const isCommandAvailable = (command: string): boolean => {
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? WINDOWS_EXTENSIONS : [""];

  for (const dir of pathValue.split(path.delimiter)) {
    if (dir === "") {
      continue;
    }

    for (const extension of extensions) {
      if (isExecutableFile(path.join(dir, command + extension))) {
        return true;
      }
    }
  }

  return false;
};
