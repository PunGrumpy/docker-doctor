import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { useraddNoLogInit } from "../src/rules/best-practices";

const check = (run: string) =>
  useraddNoLogInit.check(
    parseDockerfile(`FROM node:20\n${run}\n`),
    "Dockerfile"
  );

describe("useradd-no-log-init with exec-form shells", () => {
  test("flags a large UID when -c directly follows the shell", () => {
    expect(check('RUN ["bash","-c","useradd -u 1000000 app"]')).toHaveLength(1);
  });

  test("flags a large UID when options come before -c", () => {
    expect(
      check('RUN ["bash","-o","pipefail","-c","useradd -u 1000000 app"]')
    ).toHaveLength(1);
    expect(
      check('RUN ["/bin/sh","-e","-c","useradd -u 1000000 app"]')
    ).toHaveLength(1);
  });

  test("flags a large UID with a combined flag such as -ec", () => {
    expect(check('RUN ["sh","-ec","useradd -u 1000000 app"]')).toHaveLength(1);
    expect(
      check('RUN ["sh","-e","-ec","useradd -u 1000000 app"]')
    ).toHaveLength(1);
  });

  test("does not flag when -l is present", () => {
    expect(
      check('RUN ["bash","-o","pipefail","-c","useradd -l -u 1000000 app"]')
    ).toHaveLength(0);
  });

  test("still flags a direct useradd that has its own -c option", () => {
    expect(
      check('RUN ["useradd","-u","1000000","-c","comment","app"]')
    ).toHaveLength(1);
  });
});
