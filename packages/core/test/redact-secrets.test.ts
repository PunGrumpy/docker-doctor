import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { allRules } from "../src/rules/index";
import { redactSecrets } from "../src/rules/redact-secrets";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";

// A stand-in for a real credential. It must never reach a diagnostic.
const PLACEHOLDER = "PLACEHOLDER_TOKEN_VALUE";

describe("redactSecrets", () => {
  const masked = [
    {
      input: `ADD https://ci:${PLACEHOLDER}@example.com/a.bin /a`,
      output: "ADD https://***@example.com/a.bin /a",
    },
    {
      input: `git clone https://${PLACEHOLDER}@github.com/o/r.git`,
      output: "git clone https://***@github.com/o/r.git",
    },
    {
      input: "git clone ssh://git@github.com/o/r.git",
      output: "git clone ssh://***@github.com/o/r.git",
    },
    {
      input: `NPM_TOKEN=${PLACEHOLDER} npm ci`,
      output: "NPM_TOKEN=*** npm ci",
    },
    {
      input: `export DB_PASSWORD="${PLACEHOLDER} with spaces" && run`,
      output: "export DB_PASSWORD=*** && run",
    },
    {
      input: `npm config set //registry.npmjs.org/:_authToken=${PLACEHOLDER}`,
      output: "npm config set //registry.npmjs.org/:_authToken=***",
    },
    {
      input: `tool --api-key=${PLACEHOLDER} --apiKey ${PLACEHOLDER}`,
      output: "tool --api-key=*** --apiKey ***",
    },
  ];

  test.each(masked)("masks $output", ({ input, output }) => {
    expect(redactSecrets(input)).toBe(output);
  });

  const unchanged = [
    "ADD https://example.com/tool.tar.gz /tool",
    "git@github.com:org/repo.git",
    "NODE_ENV=production npm ci --omit=dev",
    "NPM_TOKEN=$NPM_TOKEN npm ci",
    "AUTH_ENABLED=true PATH=/usr/local/bin:$PATH",
    "POSTGRES_PASSWORD_FILE=/run/secrets/db",
    "Potential secret found in ENV: 'API_TOKEN'.",
    "docker login --password-stdin",
  ];

  test.each(unchanged)("leaves %p alone", (input) => {
    expect(redactSecrets(input)).toBe(input);
  });

  test("every rule's own message and help text is unchanged", () => {
    for (const rule of allRules) {
      expect(redactSecrets(rule.message)).toBe(rule.message);
      expect(redactSecrets(rule.help)).toBe(rule.help);
    }
  });
});

describe("no Dockerfile rule repeats a credential", () => {
  const dockerfile = [
    "FROM node:22",
    `ARG GITHUB_PAT=${PLACEHOLDER}`,
    `ENV API_TOKEN=${PLACEHOLDER}`,
    `ADD https://ci:${PLACEHOLDER}@example.com/tool.bin /tool.bin`,
    `ADD https://${PLACEHOLDER}@example.com/vendor.tar.gz /vendor`,
    `ADD ftp://ci:${PLACEHOLDER}@example.com/notes.txt /notes.txt`,
    "COPY . .",
    `RUN NPM_TOKEN=${PLACEHOLDER} npm ci`,
    `RUN npm config set //registry.npmjs.org/:_authToken=${PLACEHOLDER} && npm install`,
    `RUN pip install --index-url https://__token__:${PLACEHOLDER}@pypi.example.com/simple flask`,
    `RUN yarn install --auth-token ${PLACEHOLDER}`,
  ].join("\n");

  const diagnostics = runDockerfileRules(
    parseDockerfile(dockerfile, "Dockerfile"),
    "Dockerfile",
    ["Dockerfile"]
  );

  test("the fixture reaches every rule that quotes Dockerfile text", () => {
    const rules = new Set(diagnostics.map((d) => d.rule));

    for (const rule of [
      "docker-doctor/no-secrets-in-env",
      "docker-doctor/no-add-remote",
      "docker-doctor/prefer-copy-over-add",
      "docker-doctor/order-layers",
      "docker-doctor/avoid-dev-dependencies",
    ]) {
      expect(rules).toContain(rule);
    }
  });

  test("no message or help contains the credential", () => {
    for (const diagnostic of diagnostics) {
      expect(diagnostic.message).not.toContain(PLACEHOLDER);
      expect(diagnostic.help).not.toContain(PLACEHOLDER);
    }
  });

  test("the secrets rules still name the keys", () => {
    const keys = diagnostics
      .filter((d) => d.rule === "docker-doctor/no-secrets-in-env")
      .map((d) => d.message);

    expect(keys.some((m) => m.includes("'GITHUB_PAT'"))).toBe(true);
    expect(keys.some((m) => m.includes("'API_TOKEN'"))).toBe(true);
  });
});
