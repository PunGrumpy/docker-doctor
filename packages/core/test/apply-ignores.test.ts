import { describe, expect, test } from "bun:test";

import { readComposeIgnores } from "../src/parsers/compose-ignores";
import {
  createComposeLocator,
  parseCompose,
} from "../src/parsers/compose-parser";
import { readDockerfileIgnores } from "../src/parsers/dockerfile-ignores";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { findRuleByName } from "../src/rules/index";
import { applyIgnores } from "../src/runners/apply-ignores";
import { runComposeRules } from "../src/runners/compose-runner";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";
import type { Diagnostic, FileIgnores } from "../src/types/index";

const NO_ROOT_USER = "docker-doctor/no-root-user";
const UNKNOWN_NAME_TAIL = 500;
const UNKNOWN_NAME_CAP = 80;
const GITHUB_TOKEN_PAIRS = 18;

const scanDockerfile = (content: string, file = "Dockerfile") => {
  const instructions = parseDockerfile(content);

  return {
    diagnostics: runDockerfileRules(instructions, file, []),
    ignores: new Map([[file, readDockerfileIgnores(content, instructions)]]),
  };
};

const scanCompose = (content: string, file = "compose.yaml") => ({
  diagnostics: runComposeRules(
    parseCompose(content, file),
    file,
    undefined,
    undefined,
    createComposeLocator(content)
  ),
  ignores: new Map([[file, readComposeIgnores(content)]]),
});

const diagnostic = (rule: string, line?: number): Diagnostic => ({
  file: "Dockerfile",
  help: "",
  line,
  message: "",
  rule,
  severity: "warning",
});

const ignoresFor = (ignores: FileIgnores) => new Map([["Dockerfile", ignores]]);

const rulesOf = (diagnostics: Diagnostic[]): string[] =>
  diagnostics.map(({ rule }) => rule);

describe("findRuleByName", () => {
  test("finds a rule by its full key or its short id", () => {
    expect(findRuleByName(NO_ROOT_USER)?.key).toBe(NO_ROOT_USER);
    expect(findRuleByName("no-root-user")?.key).toBe(NO_ROOT_USER);
  });

  test("returns nothing for an unknown name", () => {
    expect(findRuleByName("no-such-rule")).toBeUndefined();
  });
});

describe("Dockerfile ignores", () => {
  const dockerfile = "FROM node:22.11.0-slim\nCOPY . .\nCMD node server.js\n";

  test("the finding is live without a comment", () => {
    const { diagnostics, ignores } = scanDockerfile(dockerfile);
    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(result.diagnostics)).toContain(NO_ROOT_USER);
    expect(result.suppressed).toEqual([]);
  });

  test("a comment above the instruction a finding is reported on suppresses it", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore no-root-user -- the platform sets the user\n${dockerfile}`
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(result.diagnostics)).not.toContain(NO_ROOT_USER);
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]).toMatchObject({
      line: 2,
      reason: "the platform sets the user",
      rule: NO_ROOT_USER,
    });
    expect(result.warnings).toEqual([]);
  });

  test("the full key works like the short id", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore ${NO_ROOT_USER}\n${dockerfile}`
    );

    expect(rulesOf(applyIgnores(diagnostics, ignores).suppressed)).toEqual([
      NO_ROOT_USER,
    ]);
  });

  test("a comment above CMD cannot suppress a finding reported at FROM", () => {
    const { diagnostics, ignores } = scanDockerfile(
      "FROM node:22.11.0-slim\nCOPY . .\n# docker-doctor-ignore no-root-user\nCMD node server.js\n"
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(result.diagnostics)).toContain(NO_ROOT_USER);
    expect(result.suppressed).toEqual([]);
  });

  test("the file form suppresses every finding of the rule in the file", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore-file no-root-user, require-healthcheck\n${dockerfile}`
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(result.suppressed).toSorted()).toEqual([
      NO_ROOT_USER,
      "docker-doctor/require-healthcheck",
    ]);
    expect(rulesOf(result.diagnostics)).not.toContain(NO_ROOT_USER);
  });

  test("a comment in one file leaves the same finding in another file live", () => {
    const withComment = scanDockerfile(
      `# docker-doctor-ignore-file no-root-user\n${dockerfile}`,
      "a/Dockerfile"
    );

    const without = scanDockerfile(dockerfile, "b/Dockerfile");

    const result = applyIgnores(
      [...withComment.diagnostics, ...without.diagnostics],
      new Map([...withComment.ignores, ...without.ignores])
    );

    expect(
      result.diagnostics.filter(({ rule }) => rule === NO_ROOT_USER)
    ).toHaveLength(1);
    expect(
      result.diagnostics.find(({ rule }) => rule === NO_ROOT_USER)?.file
    ).toBe("b/Dockerfile");
  });

  test("an unknown rule warns with file and line, and the valid names still apply", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore no-root-user, no-such-rule\n${dockerfile}`
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(result.suppressed)).toEqual([NO_ROOT_USER]);
    expect(result.warnings).toEqual([
      {
        file: "Dockerfile",
        line: 1,
        message: 'unknown rule "no-such-rule" in an ignore comment',
      },
    ]);
  });

  test("several unknown names in one comment give one warning", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore no-root-user # image is run with --user\n${dockerfile}`
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toBe(
      'unknown rules "#", "image", "is", "run", "with", "--user" in an ignore comment'
    );
    expect(rulesOf(result.suppressed)).toEqual([NO_ROOT_USER]);
  });

  test("an unknown name is masked, stripped of escapes and capped in the warning", () => {
    const token = `ghp_${"a1".repeat(GITHUB_TOKEN_PAIRS)}`;
    const long = "n".repeat(UNKNOWN_NAME_TAIL);

    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore GITHUB_TOKEN=${token}, \u001B[31mred\u200B, ${long}\n${dockerfile}`
    );

    const [warning] = applyIgnores(diagnostics, ignores).warnings;

    expect(warning?.message).not.toContain(token);
    expect(warning?.message).toContain('"GITHUB_TOKEN=***"');
    expect(warning?.message).not.toContain("\u001B");
    expect(warning?.message).not.toContain("\u200B");
    expect(warning?.message).toContain('"[31mred"');
    expect(warning?.message).toContain(`"${"n".repeat(UNKNOWN_NAME_CAP)}…"`);
    expect(warning?.message).not.toContain("n".repeat(UNKNOWN_NAME_CAP + 1));
  });

  test("warnings from the reader carry the file name", () => {
    const { diagnostics, ignores } = scanDockerfile(
      `# docker-doctor-ignore\n${dockerfile}`
    );

    const result = applyIgnores(diagnostics, ignores);

    expect(result.suppressed).toEqual([]);
    expect(result.warnings.map(({ file, line }) => [file, line])).toEqual([
      ["Dockerfile", 1],
    ]);
  });

  test("a finding on a line the comment does not cover stays live", () => {
    const { diagnostics, ignores } = scanDockerfile(
      "FROM node:22.11.0-slim\n# docker-doctor-ignore no-root-user\nCOPY . .\nCMD node server.js\n"
    );

    expect(rulesOf(applyIgnores(diagnostics, ignores).diagnostics)).toContain(
      NO_ROOT_USER
    );
  });
});

describe("Compose ignores", () => {
  test("a trailing comment suppresses the finding on its line", () => {
    const content =
      "services:\n  a:\n    image: redis:7\n    privileged: true # docker-doctor-ignore no-privileged-service -- build agent\n";

    const { diagnostics, ignores } = scanCompose(content);
    const result = applyIgnores(diagnostics, ignores);

    expect(rulesOf(diagnostics)).toContain(
      "docker-doctor/no-privileged-service"
    );
    expect(rulesOf(result.suppressed)).toEqual([
      "docker-doctor/no-privileged-service",
    ]);
    expect(result.suppressed[0]?.reason).toBe("build agent");
  });

  test("a comment above a key suppresses the finding on that key", () => {
    const content =
      "services:\n  a:\n    image: redis:7\n    # docker-doctor-ignore no-privileged-service\n    privileged: true\n";

    const { diagnostics, ignores } = scanCompose(content);

    expect(rulesOf(applyIgnores(diagnostics, ignores).suppressed)).toContain(
      "docker-doctor/no-privileged-service"
    );
  });

  test("a finding with no line is suppressed by the file form only", () => {
    const merged =
      "x-common: &common\n  privileged: true\nservices:\n  a:\n    <<: *common\n    image: redis:7\n";

    const without = scanCompose(merged);

    const unlocated = without.diagnostics.find(
      ({ rule }) => rule === "docker-doctor/no-privileged-service"
    );

    expect(unlocated?.line).toBeUndefined();

    const lineForm = scanCompose(
      merged.replace(
        "    <<: *common",
        "    # docker-doctor-ignore no-privileged-service\n    <<: *common"
      )
    );

    expect(
      rulesOf(applyIgnores(lineForm.diagnostics, lineForm.ignores).diagnostics)
    ).toContain("docker-doctor/no-privileged-service");

    const fileForm = scanCompose(
      `# docker-doctor-ignore-file no-privileged-service\n${merged}`
    );

    const result = applyIgnores(fileForm.diagnostics, fileForm.ignores);

    expect(rulesOf(result.diagnostics)).not.toContain(
      "docker-doctor/no-privileged-service"
    );
    expect(rulesOf(result.suppressed)).toContain(
      "docker-doctor/no-privileged-service"
    );
  });
});

describe("applyIgnores", () => {
  test("with no ignores every finding stays live and is returned as is", () => {
    const diagnostics = [diagnostic(NO_ROOT_USER, 1)];
    const result = applyIgnores(diagnostics, new Map());

    expect(result.diagnostics).toEqual(diagnostics);
    expect(result.suppressed).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  test("a line ignore wins over a file ignore for the reason", () => {
    const result = applyIgnores(
      [diagnostic(NO_ROOT_USER, 4)],
      ignoresFor({
        directives: [
          {
            line: 1,
            names: ["no-root-user"],
            reason: "whole file",
            scope: { kind: "file" },
          },
          {
            line: 3,
            names: ["no-root-user"],
            reason: "this line",
            scope: { kind: "line", line: 4 },
          },
        ],
        warnings: [],
      })
    );

    expect(result.suppressed[0]?.reason).toBe("this line");
  });

  test("a line ignore never matches a finding with no line", () => {
    const result = applyIgnores(
      [diagnostic(NO_ROOT_USER)],
      ignoresFor({
        directives: [
          {
            line: 1,
            names: ["no-root-user"],
            reason: null,
            scope: { kind: "line", line: 1 },
          },
        ],
        warnings: [],
      })
    );

    expect(result.suppressed).toEqual([]);
  });

  test("does not change the findings it is given", () => {
    const finding = diagnostic(NO_ROOT_USER, 1);

    applyIgnores(
      [finding],
      ignoresFor({
        directives: [
          {
            line: 1,
            names: ["no-root-user"],
            reason: "x",
            scope: { kind: "file" },
          },
        ],
        warnings: [],
      })
    );

    expect("reason" in finding).toBe(false);
  });

  test("a hostile file with many directives is matched in linear time", () => {
    const directives = Array.from({ length: 50_000 }, (_, index) => ({
      line: index + 1,
      names: ["no-root-user", "no-such-rule"],
      reason: null,
      scope: { kind: "line" as const, line: index + 1 },
    }));

    const findings = Array.from({ length: 50_000 }, (_, index) =>
      diagnostic(NO_ROOT_USER, index + 1)
    );

    const start = performance.now();

    const result = applyIgnores(
      findings,
      ignoresFor({ directives, warnings: [] })
    );

    expect(result.suppressed).toHaveLength(50_000);
    // Quadratic matching would take seconds here. A shared CI runner once
    // measured 268 ms for the linear version, so the bound leaves room.
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
