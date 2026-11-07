import { describe, expect, test } from "bun:test";

import { readComposeIgnores } from "../src/parsers/compose-ignores";
import { readDockerfileIgnores } from "../src/parsers/dockerfile-ignores";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { parseIgnoreComment } from "../src/parsers/ignore-comment";

const TIME_LIMIT_MS = 50;
const HOSTILE_LENGTH = 200_000;

const readDockerfile = (content: string) =>
  readDockerfileIgnores(content, parseDockerfile(content));

const lineScopes = (content: string) =>
  readDockerfile(content).directives.map(({ line, scope }) => [line, scope]);

describe("ignore comment syntax", () => {
  test("reads one rule", () => {
    expect(parseIgnoreComment("# docker-doctor-ignore no-root-user")).toEqual({
      form: "line",
      names: ["no-root-user"],
      reason: null,
    });
  });

  test("reads several rules separated by commas or spaces, and a reason", () => {
    expect(
      parseIgnoreComment(
        "# docker-doctor-ignore a, docker-doctor/b c -- the platform sets --user"
      )
    ).toEqual({
      form: "line",
      names: ["a", "docker-doctor/b", "c"],
      reason: "the platform sets --user",
    });
  });

  test("the file form is its own keyword", () => {
    expect(parseIgnoreComment("# docker-doctor-ignore-file a")?.form).toBe(
      "file"
    );
  });

  test("a directive with no rule name still parses, with no names", () => {
    expect(parseIgnoreComment("# docker-doctor-ignore")?.names).toEqual([]);
    expect(parseIgnoreComment("# docker-doctor-ignore -- why")).toEqual({
      form: "line",
      names: [],
      reason: "why",
    });
  });

  test("an empty reason is no reason", () => {
    expect(
      parseIgnoreComment("# docker-doctor-ignore a --")?.reason
    ).toBeNull();
  });

  test("other comments are not directives", () => {
    expect(parseIgnoreComment("# hadolint ignore=DL3002")).toBeNull();
    expect(parseIgnoreComment("# docker-doctor-ignored a")).toBeNull();
    expect(parseIgnoreComment("# docker-doctor-ignore-files a")).toBeNull();
    expect(parseIgnoreComment("# note: docker-doctor-ignore a")).toBeNull();
  });

  test("hostile input is read in linear time", () => {
    const inputs = [
      `# docker-doctor-ignore ${"a,".repeat(HOSTILE_LENGTH / 2)}`,
      `# docker-doctor-ignore a ${"- ".repeat(HOSTILE_LENGTH / 2)}`,
      `# docker-doctor-ignore ${" ".repeat(HOSTILE_LENGTH)}x`,
      `#${" ".repeat(HOSTILE_LENGTH)}docker-doctor-ignore a`,
    ];

    for (const input of inputs) {
      const start = performance.now();
      parseIgnoreComment(input);
      expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS);
    }
  });
});

describe("Dockerfile ignore comments", () => {
  test("a comment applies to the next instruction", () => {
    const content = "FROM node\n# docker-doctor-ignore no-root-user\nCMD x\n";

    expect(readDockerfile(content).directives).toEqual([
      {
        line: 2,
        names: ["no-root-user"],
        reason: null,
        scope: { kind: "line", line: 3 },
      },
    ]);
  });

  test("stacked comments all apply to the same instruction", () => {
    const content =
      "FROM node\n# docker-doctor-ignore a\n# docker-doctor-ignore b -- why\n\nCMD x\n";

    expect(lineScopes(content)).toEqual([
      [2, { kind: "line", line: 5 }],
      [3, { kind: "line", line: 5 }],
    ]);
  });

  test("a comment above a multi-line instruction applies to its first line", () => {
    const content = "FROM node\n# docker-doctor-ignore a\nRUN a \\\n  && b\n";

    expect(lineScopes(content)).toEqual([[2, { kind: "line", line: 3 }]]);
  });

  test("a # line inside a heredoc body is shell, not a directive", () => {
    const content =
      "FROM node\nRUN <<EOF\n# docker-doctor-ignore a\necho hi\nEOF\nCMD x\n";

    expect(readDockerfile(content)).toEqual({ directives: [], warnings: [] });
  });

  test("a comment between continuation lines does nothing and warns", () => {
    const content =
      "FROM node\nRUN a \\\n  # docker-doctor-ignore b\n  && c\nCMD x\n";

    const { directives, warnings } = readDockerfile(content);

    expect(directives).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.line).toBe(3);
  });

  test("a comment after the last instruction warns", () => {
    const { directives, warnings } = readDockerfile(
      "FROM node\n# docker-doctor-ignore a\n"
    );

    expect(directives).toEqual([]);
    expect(warnings[0]?.line).toBe(2);
  });

  test("a directive with no rule name warns and does nothing", () => {
    const { directives, warnings } = readDockerfile(
      "FROM node\n# docker-doctor-ignore\nCMD x\n"
    );

    expect(directives).toEqual([]);
    expect(warnings[0]?.message).toContain("names no rule");
  });

  test("reads CRLF files", () => {
    const content = "FROM node\r\n# docker-doctor-ignore a -- why\r\nCMD x\r\n";

    expect(readDockerfile(content).directives).toEqual([
      {
        line: 2,
        names: ["a"],
        reason: "why",
        scope: { kind: "line", line: 3 },
      },
    ]);
  });

  test("reads a file that starts with a byte order mark", () => {
    const content = "\uFEFF# docker-doctor-ignore-file a\nFROM node\n";

    expect(readDockerfile(content).directives).toEqual([
      {
        line: 1,
        names: ["a"],
        reason: null,
        scope: { kind: "file" },
      },
    ]);
  });
});

describe("Dockerfile ignore-file comments", () => {
  test("is honored in the comment block at the top", () => {
    const content = "# docker-doctor-ignore-file a -- legacy\nFROM node\n";

    expect(readDockerfile(content).directives).toEqual([
      {
        line: 1,
        names: ["a"],
        reason: "legacy",
        scope: { kind: "file" },
      },
    ]);
  });

  test("is honored below the parser directives", () => {
    const content =
      "# syntax=docker/dockerfile:1\n# escape=`\n# docker-doctor-ignore-file a\nFROM node\n";

    expect(readDockerfile(content).directives).toHaveLength(1);
    expect(readDockerfile(content).warnings).toEqual([]);
  });

  test("is honored after a shebang and the parser directives", () => {
    const content =
      "#!/usr/bin/env docker\n# syntax=docker/dockerfile:1\n# docker-doctor-ignore-file a\nFROM node\n";

    expect(readDockerfile(content).directives).toHaveLength(1);
  });

  test("above # syntax= it does nothing and warns", () => {
    const content =
      "# docker-doctor-ignore-file a\n# syntax=docker/dockerfile:1\nFROM node\n";

    const { directives, warnings } = readDockerfile(content);

    expect(directives).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.line).toBe(1);
    expect(warnings[0]?.message).toContain("syntax");
  });

  test("the line form above # syntax= does nothing and warns too", () => {
    const content =
      "# docker-doctor-ignore a\n# syntax=docker/dockerfile:1\nFROM node\n";

    expect(readDockerfile(content).directives).toEqual([]);
    expect(readDockerfile(content).warnings).toHaveLength(1);
  });

  test("anywhere after the first instruction it does nothing and warns", () => {
    const { directives, warnings } = readDockerfile(
      "FROM node\n# docker-doctor-ignore-file a\nCMD x\n"
    );

    expect(directives).toEqual([]);
    expect(warnings[0]?.line).toBe(2);
    expect(warnings[0]?.message).toContain("top of the Dockerfile");
  });
});

describe("Compose ignore comments", () => {
  test("a trailing comment applies to its own line", () => {
    const content =
      "services:\n  a:\n    privileged: true # docker-doctor-ignore no-privileged-service -- build agent\n";

    expect(readComposeIgnores(content).directives).toEqual([
      {
        line: 3,
        names: ["no-privileged-service"],
        reason: "build agent",
        scope: { kind: "line", line: 3 },
      },
    ]);
  });

  test("a comment on its own line applies to the next line with content", () => {
    const content =
      "services:\n  a:\n    # docker-doctor-ignore x\n\n    # a note\n    privileged: true\n";

    expect(readComposeIgnores(content).directives).toEqual([
      {
        line: 3,
        names: ["x"],
        reason: null,
        scope: { kind: "line", line: 6 },
      },
    ]);
  });

  test("stacked comments apply to the same line", () => {
    const content =
      "services:\n  a:\n    # docker-doctor-ignore x\n    # docker-doctor-ignore y\n    privileged: true\n";

    expect(
      readComposeIgnores(content).directives.map(({ scope }) => scope)
    ).toEqual([
      { kind: "line", line: 5 },
      { kind: "line", line: 5 },
    ]);
  });

  test("a # inside a block scalar is text, not a directive", () => {
    const content =
      "services:\n  a:\n    command: |\n      # docker-doctor-ignore x\n      echo hi\n";

    expect(readComposeIgnores(content)).toEqual({
      directives: [],
      warnings: [],
    });
  });

  test("a # inside a quoted string is text, not a directive", () => {
    const content =
      "services:\n  a:\n    command: \"echo # docker-doctor-ignore x\"\n    entrypoint: 'a # docker-doctor-ignore y'\n";

    expect(readComposeIgnores(content)).toEqual({
      directives: [],
      warnings: [],
    });
  });

  test("a comment after a block scalar ends the scalar and is a directive", () => {
    const content =
      "services:\n  a:\n    command: |\n      echo hi\n    # docker-doctor-ignore x\n    privileged: true\n";

    expect(readComposeIgnores(content).directives).toHaveLength(1);
  });

  test("reads CRLF files", () => {
    const content =
      "services:\r\n  a:\r\n    # docker-doctor-ignore x -- why\r\n    privileged: true\r\n";

    expect(readComposeIgnores(content).directives).toEqual([
      {
        line: 3,
        names: ["x"],
        reason: "why",
        scope: { kind: "line", line: 4 },
      },
    ]);
  });

  test("reads a file that starts with a byte order mark", () => {
    const content =
      "\uFEFF# docker-doctor-ignore-file x\nservices:\n  a:\n    image: x\n";

    expect(readComposeIgnores(content).directives).toEqual([
      {
        line: 1,
        names: ["x"],
        reason: null,
        scope: { kind: "file" },
      },
    ]);
  });

  test("the file form is honored in the comment block at the top", () => {
    const content =
      "# a note\n\n# docker-doctor-ignore-file x -- why\nservices:\n  a:\n    image: x\n";

    expect(readComposeIgnores(content).directives).toEqual([
      {
        line: 3,
        names: ["x"],
        reason: "why",
        scope: { kind: "file" },
      },
    ]);
  });

  test("the file form anywhere else does nothing and warns", () => {
    const content =
      "services:\n  # docker-doctor-ignore-file x\n  a:\n    image: x # docker-doctor-ignore-file y\n";

    const { directives, warnings } = readComposeIgnores(content);

    expect(directives).toEqual([]);
    expect(warnings.map(({ line }) => line)).toEqual([2, 4]);
  });

  test("a directive with no rule name warns and does nothing", () => {
    const { directives, warnings } = readComposeIgnores(
      "services:\n  a:\n    # docker-doctor-ignore\n    image: x\n"
    );

    expect(directives).toEqual([]);
    expect(warnings[0]?.message).toContain("names no rule");
  });

  test("a comment after the last line warns", () => {
    const { warnings } = readComposeIgnores(
      "services:\n  a:\n    image: x\n    # docker-doctor-ignore x\n"
    );

    expect(warnings).toHaveLength(1);
  });

  test("a file with many stacked comments is read in linear time", () => {
    const content = `services:\n  a:\n${"    # docker-doctor-ignore x\n".repeat(7000)}    image: x\n`;
    const start = performance.now();
    const { directives } = readComposeIgnores(content);

    expect(directives).toHaveLength(7000);
    expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS * 4);
  });
});

describe("hostile Dockerfiles", () => {
  test("many stacked comments are read in linear time", () => {
    const content = `FROM node\n${"# docker-doctor-ignore x\n".repeat(8000)}CMD x\n`;
    const start = performance.now();
    const { directives } = readDockerfile(content);

    expect(directives).toHaveLength(8000);
    expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS);
  });

  test("many unterminated continuations are read in linear time", () => {
    const content = Array.from(
      { length: 20_000 },
      (_, index) => `junk${index} \\\nRUN a`
    ).join("\n");

    const start = performance.now();
    readDockerfile(content);
    expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS * 4);
  });
});
