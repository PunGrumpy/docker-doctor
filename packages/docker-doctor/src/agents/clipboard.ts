import { spawn } from "node:child_process";

interface ClipboardCommand {
  command: string;
  args: string[];
}

const getClipboardCommands = (): ClipboardCommand[] => {
  if (process.platform === "darwin") {
    return [{ args: [], command: "pbcopy" }];
  }

  if (process.platform === "win32") {
    return [{ args: [], command: "clip" }];
  }

  return [
    { args: [], command: "wl-copy" },
    { args: ["-selection", "clipboard"], command: "xclip" },
    { args: ["--clipboard", "--input"], command: "xsel" },
  ];
};

const tryCopy = async ({ command, args }: ClipboardCommand, text: string) =>
  /* eslint-disable promise/avoid-new */
  await new Promise<boolean>((resolve) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "ignore", "ignore"],
    });

    child.once("error", () => {
      resolve(false);
    });
    child.once("exit", (code) => {
      resolve(code === 0);
    });
    child.stdin.end(text);
  });
/* eslint-enable promise/avoid-new */

const tryCommands = async (
  commands: ClipboardCommand[],
  text: string
): Promise<boolean> => {
  const first = commands.at(0);

  if (first === undefined) {
    return false;
  }

  const rest = commands.slice(1);

  if (await tryCopy(first, text)) {
    return true;
  }

  return await tryCommands(rest, text);
};

// Best-effort: tries each platform clipboard tool in order (they're fallbacks,
// so the attempts are sequential). Returns false when none worked — the
// caller prints the payload instead.
export const copyToClipboard = async (text: string): Promise<boolean> =>
  await tryCommands(getClipboardCommands(), text);
