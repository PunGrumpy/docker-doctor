import { describe, test, expect } from "bun:test";

import {
  createComposeLocator,
  parseCompose,
} from "../src/parsers/compose-parser";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
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
