import { describe, test, expect } from "bun:test";

import {
  createComposeLocator,
  parseCompose,
  readComposeFile,
} from "../src/parsers/compose-parser";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import {
  isAnalyzableCompose,
  isAnalyzableDockerfile,
} from "../src/runners/analyzable";
import {
  runComposeFiles,
  runComposeRules,
} from "../src/runners/compose-runner";
import type { ComposeSource } from "../src/runners/compose-runner";
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

  test("reads the values behind Compose merge tags", () => {
    const source = `services:
  web:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports: !reset []
    deploy: !override
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
  worker:
    build: .
    restart: unless-stopped
    image: !reset null
`;

    const diagnostics = runComposeRules(
      parseCompose(source, "compose.yml"),
      "compose.yml",
      undefined,
      undefined,
      createComposeLocator(source)
    );

    // web keeps the limits it sets under !override. Only worker has none.
    expect(diagnostics.map((d) => d.rule)).toEqual([
      "docker-doctor/require-resource-limits",
    ]);
    expect(diagnostics[0].message).toContain("'worker'");
    expect(diagnostics[0].line).toBe(11);
  });

  test("an image removed by !reset or emptied by !override is not asked for a tag", () => {
    const source = `services:
  web:
    image: !reset null
  worker:
    image: !override
`;

    const diagnostics = runComposeRules(
      parseCompose(source, "compose.override.yaml"),
      "compose.override.yaml"
    );

    expect(
      findByRule(diagnostics, "docker-doctor/pin-service-image")
    ).toBeUndefined();
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

const source = (file: string, content: string): ComposeSource => ({
  compose: readComposeFile(content, file),
  file,
  locate: createComposeLocator(content),
});

const findingsOf = (
  results: Map<string, Diagnostic[]>,
  file: string
): string[] =>
  (results.get(file) ?? []).map((d) => `${d.rule}:${d.line ?? "-"}`);

describe("runComposeFiles", () => {
  const healthyBase = `services:
  web:
    image: nginx:1.27-alpine
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
`;

  test("an override that only adds settings draws no findings", () => {
    const results = runComposeFiles([
      source("compose.yaml", healthyBase),
      source(
        "compose.override.yaml",
        "services:\n  web:\n    environment:\n      LOG_LEVEL: debug\n"
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([]);
  });

  test("the same override judged alone still lacks limits and a restart policy", () => {
    const results = runComposeFiles([
      source(
        "dev/compose.override.yaml",
        "services:\n  web:\n    environment:\n      LOG_LEVEL: debug\n"
      ),
      source("compose.yaml", healthyBase),
    ]);

    expect(findingsOf(results, "dev/compose.override.yaml")).toEqual([
      "docker-doctor/require-resource-limits:2",
      "docker-doctor/require-restart-policy:2",
    ]);
  });

  test("a setting the override resets is reported on the base, at the service", () => {
    const results = runComposeFiles([
      source("compose.yaml", healthyBase),
      source(
        "compose.override.yaml",
        "services:\n  web:\n    restart: !reset null\n"
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([
      "docker-doctor/require-restart-policy:2",
    ]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([]);
  });

  test("a base service missing a setting is reported once, on the base", () => {
    const results = runComposeFiles([
      source(
        "compose.yaml",
        "services:\n  db:\n    image: postgres:17\n    restart: always\n"
      ),
      source(
        "compose.override.yaml",
        'services:\n  db:\n    ports: ["5432:5432"]\n'
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([
      "docker-doctor/require-resource-limits:2",
    ]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([]);
  });

  test("a service only the override defines is reported on the override", () => {
    const results = runComposeFiles([
      source("compose.yaml", healthyBase),
      source(
        "compose.override.yaml",
        "services:\n  adminer:\n    image: adminer:4.8.1\n"
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([
      "docker-doctor/require-resource-limits:2",
      "docker-doctor/require-restart-policy:2",
    ]);
  });

  test("a model declared in the base satisfies a reference in the override", () => {
    const results = runComposeFiles([
      source(
        "compose.yaml",
        `models:
  llm:
    model: ai/smollm2:360M-Q4_K_M
services:
  app:
    image: app:1.0
    restart: always
    mem_limit: 512m
`
      ),
      source(
        "compose.override.yaml",
        "services:\n  app:\n    models: [llm, embed]\n"
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([
      "docker-doctor/undefined-model-reference:5",
    ]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([]);
  });

  test("rules that report a risky line still judge the override's own lines", () => {
    const results = runComposeFiles([
      source("compose.yaml", healthyBase),
      source(
        "compose.override.yaml",
        "services:\n  web:\n    image: nginx:latest\n"
      ),
    ]);

    expect(findingsOf(results, "compose.override.yaml")).toEqual([
      "docker-doctor/pin-service-image:3",
    ]);
  });

  test("a one-shot job the override adds and the base waits on needs no restart policy", () => {
    const results = runComposeFiles([
      source("compose.yaml", healthyBase),
      source(
        "compose.override.yaml",
        `services:
  web:
    depends_on:
      seed:
        condition: service_completed_successfully
  seed:
    image: app:1.0
    mem_limit: 256m
`
      ),
    ]);

    expect(findingsOf(results, "compose.yaml")).toEqual([]);
    expect(findingsOf(results, "compose.override.yaml")).toEqual([]);
  });

  test("the configured severity applies to findings on the merged service", () => {
    const results = runComposeFiles(
      [
        source("compose.yaml", healthyBase),
        source(
          "compose.override.yaml",
          "services:\n  web:\n    restart: !reset null\n"
        ),
      ],
      { rulesConfig: { "docker-doctor/require-restart-policy": "error" } }
    );

    expect(results.get("compose.yaml")?.[0]?.severity).toBe("error");
  });
});
