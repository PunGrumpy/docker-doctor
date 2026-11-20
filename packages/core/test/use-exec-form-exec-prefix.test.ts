import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { useExecForm } from "../src/rules/best-practices";

const check = (instruction: string) =>
  useExecForm.check(
    parseDockerfile(`FROM ubuntu:24.04\n${instruction}\n`),
    "Dockerfile"
  );

describe("use-exec-form with a shell-form command that starts with exec", () => {
  test("accepts the Dockerfile reference ENTRYPOINT example", () => {
    expect(check("ENTRYPOINT exec top -b")).toHaveLength(0);
  });

  test("accepts exec in CMD", () => {
    expect(check("CMD exec node server.js")).toHaveLength(0);
  });

  test("skips leading variable assignments before exec", () => {
    expect(check("ENTRYPOINT FOO=1 BAR=2 exec app")).toHaveLength(0);
  });

  test("still reports a command that does not start with exec", () => {
    expect(check("CMD node server.js")).toHaveLength(1);
    expect(check("CMD cd /app && exec node server.js")).toHaveLength(1);
  });

  test("still reports exec with nothing to run", () => {
    expect(check("ENTRYPOINT exec")).toHaveLength(1);
    expect(check("ENTRYPOINT FOO=1 exec")).toHaveLength(1);
  });

  test("still reports exec followed by an operator or only a redirection", () => {
    expect(check("CMD exec && node server.js")).toHaveLength(1);
    expect(check("ENTRYPOINT exec > /tmp/log")).toHaveLength(1);
    expect(check("CMD exec 2>&1")).toHaveLength(1);
    expect(check("CMD exec; node server.js")).toHaveLength(1);
  });

  test("accepts exec with an option before the command", () => {
    expect(check("ENTRYPOINT exec -a app node server.js")).toHaveLength(0);
  });

  test("still reports a word that only begins with exec", () => {
    expect(check("CMD executable --flag")).toHaveLength(1);
  });

  test("still reports a variable assignment with no command", () => {
    expect(check("CMD FOO=1")).toHaveLength(1);
  });

  test("still accepts exec form", () => {
    expect(check('CMD ["node", "server.js"]')).toHaveLength(0);
  });
});
