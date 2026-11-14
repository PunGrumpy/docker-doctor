import { describe, expect, test } from "bun:test";

import { readComposeIgnores } from "../src/parsers/compose-ignores";
import {
  createComposeLocator,
  parseCompose,
} from "../src/parsers/compose-parser";
import { parseDockerfileDirectives } from "../src/parsers/dockerfile-directives";
import { readDockerfileIgnores } from "../src/parsers/dockerfile-ignores";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { applyIgnores } from "../src/runners/apply-ignores";
import { runComposeRules } from "../src/runners/compose-runner";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";
import { fingerprintDiagnostics } from "../src/runners/fingerprint";
import type { Diagnostic, FingerprintedDiagnostic } from "../src/types/index";

const DOCKERFILE = "Dockerfile";
const COMPOSE = "compose.yaml";
const HEX_FINGERPRINT = /^[0-9a-f]{16}$/u;

const scanDockerfile = (content: string): FingerprintedDiagnostic[] =>
  fingerprintDiagnostics(
    runDockerfileRules(
      parseDockerfile(content),
      DOCKERFILE,
      [],
      undefined,
      undefined,
      parseDockerfileDirectives(content)
    ),
    { [DOCKERFILE]: content }
  );

const scanCompose = (content: string): FingerprintedDiagnostic[] =>
  fingerprintDiagnostics(
    runComposeRules(
      parseCompose(content, COMPOSE),
      COMPOSE,
      undefined,
      undefined,
      createComposeLocator(content)
    ),
    { [COMPOSE]: content }
  );

const fingerprintsOf = (
  diagnostics: FingerprintedDiagnostic[],
  rule?: string
): string[] =>
  diagnostics
    .flatMap((d) =>
      rule === undefined || d.rule === `docker-doctor/${rule}`
        ? [d.fingerprint]
        : []
    )
    .toSorted();

const BASE_DOCKERFILE = [
  "FROM node:20",
  "WORKDIR /app",
  "RUN apt-get update && apt-get install -y curl",
  "RUN cd /app && make",
  "COPY . .",
  'CMD ["node", "server.js"]',
].join("\n");

const scanWithSecret = (value: string): FingerprintedDiagnostic[] =>
  scanDockerfile(`FROM node:20\nENV DB_PASSWORD=${value}\nUSER node`);

describe("fingerprintDiagnostics on a Dockerfile", () => {
  test("gives every finding a distinct 16-character hex fingerprint", () => {
    const fingerprints = fingerprintsOf(scanDockerfile(BASE_DOCKERFILE));

    expect(fingerprints.length).toBeGreaterThan(3);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);

    for (const fingerprint of fingerprints) {
      expect(fingerprint).toMatch(HEX_FINGERPRINT);
    }
  });

  test("keeps every fingerprint when lines are inserted above the findings", () => {
    const moved = `# syntax=docker/dockerfile:1\n# build image\n\n${BASE_DOCKERFILE.replace(
      "WORKDIR /app",
      "WORKDIR /app\n\n\n"
    )}`;

    expect(fingerprintsOf(scanDockerfile(moved))).toEqual(
      fingerprintsOf(scanDockerfile(BASE_DOCKERFILE))
    );
  });

  test("changes only the fingerprint of the edited instruction", () => {
    const before = scanDockerfile(BASE_DOCKERFILE);

    const after = scanDockerfile(
      BASE_DOCKERFILE.replace("install -y curl", "install -y curl git")
    );

    const kept = new Set(fingerprintsOf(before));
    const changed = after.filter((d) => !kept.has(d.fingerprint));

    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((d) => d.line === 3)).toBe(true);
    expect(
      after.filter((d) => d.line !== 3).every((d) => kept.has(d.fingerprint))
    ).toBe(true);
  });

  test("counts identical instructions apart and keeps both stable", () => {
    const twice = `${BASE_DOCKERFILE}\nRUN cd /app && make`;
    const runCd = fingerprintsOf(scanDockerfile(twice), "avoid-run-cd");

    expect(runCd).toHaveLength(2);
    expect(new Set(runCd).size).toBe(2);
    expect(
      fingerprintsOf(scanDockerfile(`\n\n${twice}`), "avoid-run-cd")
    ).toEqual(runCd);
  });

  test("anchors whole-file rules to the file, not the line they report", () => {
    const rules = ["no-root-user", "require-labels", "require-healthcheck"];
    const before = scanDockerfile(BASE_DOCKERFILE);

    const after = scanDockerfile(
      `# syntax=docker/dockerfile:1\n${BASE_DOCKERFILE.replace("node:20", "node:22")}`
    );

    for (const rule of rules) {
      expect(fingerprintsOf(before, rule)).toHaveLength(1);
      expect(fingerprintsOf(after, rule)).toEqual(fingerprintsOf(before, rule));
    }
  });

  test("keeps the fingerprint when only the secret value changes", () => {
    const before = fingerprintsOf(
      scanWithSecret("hunter2"),
      "no-secrets-in-env"
    );

    expect(before).toHaveLength(1);
    expect(
      fingerprintsOf(scanWithSecret("correct-horse"), "no-secrets-in-env")
    ).toEqual(before);
  });

  test("ignores the message, which can quote line numbers", () => {
    const finding = (message: string): Diagnostic => ({
      file: DOCKERFILE,
      help: "",
      line: 4,
      message,
      rule: "docker-doctor/minimize-layers",
      severity: "info",
    });

    const contents = { [DOCKERFILE]: BASE_DOCKERFILE };

    expect(
      fingerprintDiagnostics([finding("starting at line 3")], contents)
    ).toEqual(
      fingerprintDiagnostics([finding("starting at line 3")], contents)
    );
    expect(
      fingerprintDiagnostics([finding("starting at line 3")], contents)[0]
        ?.fingerprint
    ).toBe(
      fingerprintDiagnostics([finding("starting at line 9")], contents)[0]
        ?.fingerprint
    );
  });

  test("an ignore comment on one of two identical findings renumbers neither", () => {
    const twice = `${BASE_DOCKERFILE}\nRUN cd /app && make`;

    const ignored = twice.replace(
      "RUN cd /app && make",
      "# docker-doctor-ignore avoid-run-cd\nRUN cd /app && make"
    );

    const instructions = parseDockerfile(ignored);

    const { diagnostics, suppressed } = applyIgnores(
      fingerprintDiagnostics(runDockerfileRules(instructions, DOCKERFILE, []), {
        [DOCKERFILE]: ignored,
      }),
      new Map([[DOCKERFILE, readDockerfileIgnores(ignored, instructions)]])
    );

    expect(
      fingerprintsOf([...diagnostics, ...suppressed], "avoid-run-cd")
    ).toEqual(fingerprintsOf(scanDockerfile(twice), "avoid-run-cd"));
    expect(fingerprintsOf(suppressed, "avoid-run-cd")).toHaveLength(1);
  });
});

const BASE_COMPOSE = [
  "services:",
  "  web:",
  "    image: nginx:latest",
  "    privileged: true",
  "    environment:",
  "      - API_TOKEN=abc123def456",
  "    volumes:",
  "      - /var/run/docker.sock:/var/run/docker.sock",
].join("\n");

const LONG_SYNTAX_COMPOSE = [
  "services:",
  "  web:",
  "    image: nginx:1.27",
  "    volumes:",
  "      - type: bind",
  "        source: /var/run/docker.sock",
  "        target: /var/run/docker.sock",
  "      - type: bind",
  "        source: /",
  "        target: /host",
  "        x-password: hunter2",
].join("\n");

const scanComposeWithIgnores = (content: string): FingerprintedDiagnostic[] => {
  const { diagnostics, suppressed } = applyIgnores(
    scanCompose(content),
    new Map([[COMPOSE, readComposeIgnores(content)]])
  );

  return [...diagnostics, ...suppressed];
};

describe("fingerprintDiagnostics on a Compose file", () => {
  test("keeps every fingerprint when a service is added above", () => {
    const added = BASE_COMPOSE.replace(
      "services:\n",
      "services:\n  cache:\n    image: redis:7\n    restart: always\n"
    );

    const kept = new Set(fingerprintsOf(scanCompose(added)));

    expect(
      fingerprintsOf(scanCompose(BASE_COMPOSE)).every((f) => kept.has(f))
    ).toBe(true);
  });

  test("keeps the fingerprint of a list item when items are inserted above it", () => {
    const inserted = BASE_COMPOSE.replace(
      "    environment:\n",
      "    environment:\n      - LOG_LEVEL=debug\n      - PORT=8080\n"
    ).replace("    volumes:\n", "    volumes:\n      - ./data:/data\n");

    for (const rule of ["no-plaintext-secrets", "no-docker-socket-mount"]) {
      const before = fingerprintsOf(scanCompose(BASE_COMPOSE), rule);

      expect(before).toHaveLength(1);
      expect(fingerprintsOf(scanCompose(inserted), rule)).toEqual(before);
    }
  });

  test("changes the fingerprint when the service it points at is renamed", () => {
    const renamed = BASE_COMPOSE.replace("  web:", "  api:");

    expect(
      fingerprintsOf(scanCompose(renamed), "no-privileged-service")
    ).not.toEqual(
      fingerprintsOf(scanCompose(BASE_COMPOSE), "no-privileged-service")
    );
  });

  test("an ignore comment leaves the suppressed finding its fingerprint", () => {
    const ignored = BASE_COMPOSE.replace(
      "    privileged: true",
      "    privileged: true # docker-doctor-ignore no-privileged-service"
    );

    const { suppressed } = applyIgnores(
      fingerprintDiagnostics(
        runComposeRules(
          parseCompose(ignored, COMPOSE),
          COMPOSE,
          undefined,
          undefined,
          createComposeLocator(ignored)
        ),
        { [COMPOSE]: ignored }
      ),
      new Map([[COMPOSE, readComposeIgnores(ignored)]])
    );

    expect(suppressed.map((d) => d.fingerprint)).toEqual(
      fingerprintsOf(scanCompose(BASE_COMPOSE), "no-privileged-service")
    );
  });

  test("an ignore comment inside a long-syntax list item moves no fingerprint", () => {
    const ignored = LONG_SYNTAX_COMPOSE.replace(
      "      - type: bind\n        source: /\n",
      "      - type: bind # docker-doctor-ignore no-broad-bind-mount -- dev only\n        source: /\n"
    );

    expect(fingerprintsOf(scanComposeWithIgnores(ignored))).toEqual(
      fingerprintsOf(scanCompose(LONG_SYNTAX_COMPOSE))
    );
  });

  test("a comment edit inside a long-syntax list item moves no fingerprint", () => {
    const commented = LONG_SYNTAX_COMPOSE.replace(
      "        source: /\n",
      "        source: / # the host root\n"
    );

    expect(fingerprintsOf(scanCompose(commented))).toEqual(
      fingerprintsOf(scanCompose(LONG_SYNTAX_COMPOSE))
    );
  });

  test("a rotated secret inside a long-syntax list item moves no fingerprint", () => {
    const before = fingerprintsOf(scanCompose(LONG_SYNTAX_COMPOSE));

    expect(before.length).toBeGreaterThan(2);
    expect(
      fingerprintsOf(
        scanCompose(LONG_SYNTAX_COMPOSE.replace("hunter2", "Rotated9z"))
      )
    ).toEqual(before);
  });

  test("an edit to a long-syntax list item's value moves its fingerprints", () => {
    const rule = "prefer-read-only-bind-mount";

    expect(
      fingerprintsOf(
        scanCompose(
          LONG_SYNTAX_COMPOSE.replace("target: /host", "target: /mnt")
        ),
        rule
      )
    ).not.toEqual(fingerprintsOf(scanCompose(LONG_SYNTAX_COMPOSE), rule));
  });
});
