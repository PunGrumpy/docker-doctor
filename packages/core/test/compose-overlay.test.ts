import { describe, expect, test } from "bun:test";

import {
  overlayCompose,
  pairComposeFiles,
} from "../src/parsers/compose-overlay";
import { readComposeFile } from "../src/parsers/compose-parser";

const overlay = (base: string, override: string) =>
  overlayCompose(
    readComposeFile(base, "compose.yaml"),
    readComposeFile(override, "compose.override.yaml")
  );

describe("pairComposeFiles", () => {
  test("pairs the base and override Compose loads from one directory", () => {
    expect(
      pairComposeFiles([
        "compose.yaml",
        "compose.override.yaml",
        "api/docker-compose.yml",
        "api/docker-compose.override.yml",
        "compose.prod.yaml",
      ])
    ).toEqual([
      { base: "compose.yaml", override: "compose.override.yaml" },
      {
        base: "api/docker-compose.yml",
        override: "api/docker-compose.override.yml",
      },
    ]);
  });

  test("does not pair an override with no base beside it", () => {
    expect(
      pairComposeFiles(["compose.yaml", "dev/compose.override.yaml"])
    ).toEqual([]);
  });

  test("picks the names Compose prefers and warns about the others", () => {
    const warnings: string[] = [];

    const overlays = pairComposeFiles(
      [
        "docker-compose.yml",
        "compose.yaml",
        "docker-compose.override.yml",
        "compose.override.yaml",
      ],
      (message) => {
        warnings.push(message);
      }
    );

    expect(overlays).toEqual([
      { base: "compose.yaml", override: "compose.override.yaml" },
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Compose uses compose.yaml");
    expect(warnings[1]).toContain("Compose uses compose.override.yaml");
  });

  test("prefers compose.override.yml over compose.override.yaml, as Compose does", () => {
    expect(
      pairComposeFiles([
        "compose.yaml",
        "compose.override.yaml",
        "compose.override.yml",
      ])
    ).toEqual([{ base: "compose.yaml", override: "compose.override.yml" }]);
  });

  test("says nothing when each directory has one base and one override", () => {
    const warnings: string[] = [];

    pairComposeFiles(["compose.yaml", "compose.override.yaml"], (message) => {
      warnings.push(message);
    });

    expect(warnings).toEqual([]);
  });
});

describe("overlayCompose", () => {
  test("merges an override's settings into the base service", () => {
    const merged = overlay(
      `services:
  web:
    image: nginx:1.27
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 256M
`,
      `services:
  web:
    restart: always
    deploy:
      resources:
        limits:
          cpus: "0.5"
`
    );

    expect(merged).toEqual({
      services: {
        web: {
          deploy: { resources: { limits: { cpus: "0.5", memory: "256M" } } },
          image: "nginx:1.27",
          restart: "always",
        },
      },
    });
  });

  test("a null in the override keeps the base value", () => {
    const merged = overlay(
      "services:\n  web:\n    restart: always\n",
      "services:\n  web:\n    restart:\n  worker:\n"
    );

    expect(merged).toEqual({
      services: { web: { restart: "always" }, worker: null },
    });
  });

  test("!reset removes the base value", () => {
    const merged = overlay(
      "services:\n  web:\n    image: app:1.0\n    restart: always\n",
      "services:\n  web:\n    restart: !reset null\n"
    );

    expect(merged).toEqual({ services: { web: { image: "app:1.0" } } });
  });

  test("!override replaces the base value instead of merging into it", () => {
    const merged = overlay(
      `services:
  web:
    deploy:
      restart_policy:
        condition: on-failure
      resources:
        limits:
          memory: 256M
`,
      `services:
  web:
    deploy: !override
      replicas: 2
`
    );

    expect(merged).toEqual({ services: { web: { deploy: { replicas: 2 } } } });
  });

  test("!reset through a merge key removes the base value at each service that merges it", () => {
    const merged = overlay(
      `services:
  web:
    image: app:1.0
    restart: always
  api:
    image: app:1.0
    restart: always
`,
      `x-common: &common
  restart: !reset
services:
  web:
    <<: *common
  api:
    <<: *common
`
    );

    expect(merged).toEqual({
      services: { api: { image: "app:1.0" }, web: { image: "app:1.0" } },
      "x-common": {},
    });
  });

  test("!override through a merge key replaces the base value", () => {
    const merged = overlay(
      `services:
  web:
    deploy:
      resources:
        limits:
          memory: 1G
`,
      `x-dev: &dev
  deploy: !override
    replicas: 1
services:
  web:
    <<: *dev
`
    );

    expect(merged).toEqual({
      services: { web: { deploy: { replicas: 1 } } },
      "x-dev": { deploy: { replicas: 1 } },
    });
  });

  test("!reset in an inline merge mapping removes the base value", () => {
    const merged = overlay(
      "services:\n  web:\n    image: app:1.0\n    restart: always\n",
      "services:\n  web:\n    <<: {restart: !reset null}\n"
    );

    expect(merged).toEqual({ services: { web: { image: "app:1.0" } } });
  });

  test("depends_on merges the short and long forms by service", () => {
    const merged = overlay(
      "services:\n  web:\n    depends_on: [db, migrate]\n",
      `services:
  web:
    depends_on:
      migrate:
        condition: service_completed_successfully
`
    );

    expect(merged).toEqual({
      services: {
        web: {
          depends_on: {
            db: { condition: "service_started", required: true },
            migrate: {
              condition: "service_completed_successfully",
              required: true,
            },
          },
        },
      },
    });
  });

  test("service models and top-level models merge by name", () => {
    const merged = overlay(
      "models:\n  llm:\n    model: ai/smollm2:360M\nservices:\n  app:\n    models: [llm]\n",
      "models:\n  embed:\n    model: ai/mxbai:335M\nservices:\n  app:\n    models:\n      embed: {}\n"
    );

    expect(merged).toEqual({
      models: {
        embed: { model: "ai/mxbai:335M" },
        llm: { model: "ai/smollm2:360M" },
      },
      services: { app: { models: { embed: {}, llm: null } } },
    });
  });

  test("an empty override leaves the base as it is", () => {
    const base = "services:\n  web:\n    image: app:1.0\n";

    expect(overlay(base, "")).toEqual({
      services: { web: { image: "app:1.0" } },
    });
  });
});
