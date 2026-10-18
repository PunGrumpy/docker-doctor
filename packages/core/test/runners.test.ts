import { describe, test, expect } from "bun:test";

import {
  createComposeLocator,
  parseCompose,
} from "../src/parsers/compose-parser";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  isAnalyzableCompose,
  isAnalyzableDockerfile,
} from "../src/runners/analyzable";
import { runComposeRules } from "../src/runners/compose-runner";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";
import type { Diagnostic } from "../src/types/index";

const findByRule = (
  diagnostics: Diagnostic[],
  rule: string
): Diagnostic | undefined => diagnostics.find((d) => d.rule === rule);

describe("runDockerfileRules", () => {
  // No tag on the base image (triggers pin-image-version) and no USER
  // instruction (triggers no-root-user) -- two Security rules firing at
  // once, needed for the precedence tests below.
  const rootDockerfile = parseDockerfile(`
    FROM node
    COPY . .
  `);

  test("no config: reports no-root-user at its default severity", () => {
    const diagnostics = runDockerfileRules(rootDockerfile, "Dockerfile", []);
    const rootUserDiag = findByRule(diagnostics, "docker-doctor/no-root-user");
    expect(rootUserDiag).toBeDefined();
    expect(rootUserDiag?.severity).toBe("warning");
    expect(rootUserDiag?.category).toBe("Security");
  });

  test('rules: { "docker-doctor/no-root-user": "off" } skips that rule, leaves others', () => {
    const diagnostics = runDockerfileRules(rootDockerfile, "Dockerfile", [], {
      "docker-doctor/no-root-user": "off",
    });
    expect(
      diagnostics.some((d) => d.rule === "docker-doctor/no-root-user")
    ).toBe(false);
    // A different Security rule (unpinned base image) should still fire.
    expect(
      diagnostics.some((d) => d.rule === "docker-doctor/pin-image-version")
    ).toBe(true);
  });

  test('rules: { "docker-doctor/no-root-user": "error" } overrides its severity', () => {
    const diagnostics = runDockerfileRules(rootDockerfile, "Dockerfile", [], {
      "docker-doctor/no-root-user": "error",
    });
    const rootUserDiag = findByRule(diagnostics, "docker-doctor/no-root-user");
    expect(rootUserDiag?.severity).toBe("error");
  });

  test('categories: { Security: "off" } drops every Security diagnostic', () => {
    const diagnostics = runDockerfileRules(
      rootDockerfile,
      "Dockerfile",
      [],
      undefined,
      { Security: "off" }
    );
    expect(diagnostics.some((d) => d.rule.startsWith("docker-doctor/"))).toBe(
      true
    );
    expect(
      diagnostics.some((d) =>
        [
          "docker-doctor/no-root-user",
          "docker-doctor/pin-image-version",
        ].includes(d.rule)
      )
    ).toBe(false);
  });

  test('categories: { Security: "error" } overrides no-root-user severity', () => {
    const diagnostics = runDockerfileRules(
      rootDockerfile,
      "Dockerfile",
      [],
      undefined,
      { Security: "error" }
    );
    const rootUserDiag = findByRule(diagnostics, "docker-doctor/no-root-user");
    expect(rootUserDiag?.severity).toBe("error");
  });

  test("per-rule severity wins over category severity", () => {
    const diagnostics = runDockerfileRules(
      rootDockerfile,
      "Dockerfile",
      [],
      { "docker-doctor/no-root-user": "info" },
      { Security: "error" }
    );
    const rootUserDiag = findByRule(diagnostics, "docker-doctor/no-root-user");
    const pinVersionDiag = findByRule(
      diagnostics,
      "docker-doctor/pin-image-version"
    );
    expect(rootUserDiag?.severity).toBe("info");
    expect(pinVersionDiag?.severity).toBe("error");
  });

  test("returns nothing for an instruction-free Dockerfile", () => {
    const diagnostics = runDockerfileRules(
      parseDockerfile("# only a comment\n"),
      "Dockerfile",
      []
    );

    expect(diagnostics).toEqual([]);
  });
});

describe("runComposeRules", () => {
  const composeMissingRestart = {
    services: {
      web: { image: "node:22-alpine" },
    },
    version: "3.8",
  };

  test("no config: reports require-restart-policy at its default severity", () => {
    const diagnostics = runComposeRules(composeMissingRestart, "compose.yml");
    const restartDiag = findByRule(
      diagnostics,
      "docker-doctor/require-restart-policy"
    );
    expect(restartDiag).toBeDefined();
    expect(restartDiag?.severity).toBe("warning");
  });

  test("forwards a locator so diagnostics carry line numbers", () => {
    const source = 'version: "3.8"\nservices:\n  web:\n    image: node:22\n';
    const diagnostics = runComposeRules(
      parseCompose(source, "compose.yml"),
      "compose.yml",
      undefined,
      undefined,
      createComposeLocator(source)
    );
    const versionDiag = findByRule(diagnostics, "docker-doctor/no-version-key");
    const restartDiag = findByRule(
      diagnostics,
      "docker-doctor/require-restart-policy"
    );
    expect(versionDiag?.line).toBe(1);
    expect(restartDiag?.line).toBe(3);
  });

  test('rules: { "docker-doctor/require-restart-policy": "off" } skips that rule, leaves others', () => {
    const diagnostics = runComposeRules(composeMissingRestart, "compose.yml", {
      "docker-doctor/require-restart-policy": "off",
    });
    expect(
      diagnostics.some((d) => d.rule === "docker-doctor/require-restart-policy")
    ).toBe(false);
    expect(
      diagnostics.some((d) => d.rule === "docker-doctor/no-version-key")
    ).toBe(true);
  });

  test('rules: { "docker-doctor/require-restart-policy": "error" } overrides its severity', () => {
    const diagnostics = runComposeRules(composeMissingRestart, "compose.yml", {
      "docker-doctor/require-restart-policy": "error",
    });
    const restartDiag = findByRule(
      diagnostics,
      "docker-doctor/require-restart-policy"
    );
    expect(restartDiag?.severity).toBe("error");
  });

  test('categories: { Compose: "off" } drops every Compose diagnostic', () => {
    const diagnostics = runComposeRules(
      composeMissingRestart,
      "compose.yml",
      undefined,
      { Compose: "off" }
    );
    expect(diagnostics).toHaveLength(0);
  });

  test('categories: { Compose: "error" } overrides require-restart-policy severity', () => {
    const diagnostics = runComposeRules(
      composeMissingRestart,
      "compose.yml",
      undefined,
      { Compose: "error" }
    );
    const restartDiag = findByRule(
      diagnostics,
      "docker-doctor/require-restart-policy"
    );
    expect(restartDiag?.severity).toBe("error");
  });

  test("per-rule severity wins over category severity", () => {
    const diagnostics = runComposeRules(
      composeMissingRestart,
      "compose.yml",
      { "docker-doctor/require-restart-policy": "info" },
      { Compose: "error" }
    );
    const restartDiag = findByRule(
      diagnostics,
      "docker-doctor/require-restart-policy"
    );
    const versionDiag = findByRule(diagnostics, "docker-doctor/no-version-key");
    expect(restartDiag?.severity).toBe("info");
    expect(versionDiag?.severity).toBe("error");
  });
});

describe("analyzable files", () => {
  const dockerfileCases = [
    { analyzable: false, content: "", name: "an empty Dockerfile" },
    {
      analyzable: false,
      content: "# syntax=docker/dockerfile:1\n# a comment\n",
      name: "a comment-only Dockerfile",
    },
    {
      analyzable: false,
      content: "This is prose about a Dockerfile.\n",
      name: "a file with no instruction lines",
    },
    {
      analyzable: true,
      content: "FROM node:22-slim\nUSER node\n",
      name: "a Dockerfile with instructions",
    },
  ];

  test.each(dockerfileCases)(
    "$name: $analyzable",
    ({ analyzable, content }) => {
      expect(isAnalyzableDockerfile(parseDockerfile(content))).toBe(analyzable);
    }
  );

  const composeCases = [
    { analyzable: false, content: "", name: "an empty file" },
    { analyzable: false, content: "{}\n", name: "an empty mapping" },
    { analyzable: false, content: "- web\n- db\n", name: "a list" },
    { analyzable: false, content: "just text\n", name: "a scalar" },
    {
      analyzable: false,
      content: "services: {}\nnetworks:\n  default: {}\n",
      name: "a mapping with no services",
    },
    {
      analyzable: false,
      content: "services:\n  - web\n",
      name: "services written as a list",
    },
    {
      analyzable: true,
      content: "services:\n  web:\n    image: nginx:1.27\n",
      name: "a file with a service",
    },
    {
      analyzable: true,
      content: "services:\n  web:\n",
      name: "a service with an empty body",
    },
    {
      analyzable: true,
      content: "models:\n  llm:\n    model: ai/smollm2\n",
      name: "a file with only top-level models",
    },
    {
      analyzable: true,
      content: 'version: "3.8"\n',
      name: "a file with only the version key",
    },
  ];

  test.each(composeCases)("$name: $analyzable", ({ analyzable, content }) => {
    expect(isAnalyzableCompose(parseCompose(content, "compose.yaml"))).toBe(
      analyzable
    );
  });

  // The score divides by the number of analyzable files, so a file that
  // is not analyzable must never contribute a finding.
  test("runComposeRules reports nothing for a file that is not analyzable", () => {
    for (const { analyzable, content } of composeCases) {
      if (!analyzable) {
        expect(
          runComposeRules(parseCompose(content, "compose.yaml"), "compose.yaml")
        ).toEqual([]);
      }
    }
  });

  test("a Dockerfile stays analyzable when config turns every rule off", () => {
    const instructions = parseDockerfile("FROM node\n");
    const diagnostics = runDockerfileRules(
      instructions,
      "Dockerfile",
      [],
      {},
      {
        "Best Practices": "off",
        Compose: "off",
        "Image Size": "off",
        Performance: "off",
        Security: "off",
      }
    );
    expect(diagnostics).toEqual([]);
    expect(isAnalyzableDockerfile(instructions)).toBe(true);
  });
});
