import { describe, expect, test } from "bun:test";

import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { allRules } from "../src/rules/index";
import { redactSecrets } from "../src/rules/redact-secrets";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";

const PLACEHOLDER = "PLACEHOLDER_TOKEN_VALUE";

describe("redactSecrets", () => {
  const masked = [
    {
      input: `ADD https://ci:${PLACEHOLDER}@example.com/a.bin /a`,
      output: "ADD https://***@example.com/a.bin /a",
    },
    {
      input: `curl -https://ci:${PLACEHOLDER}@example.com/a 1.https://ci:${PLACEHOLDER}@example.com/b`,
      output: "curl -https://***@example.com/a 1.https://***@example.com/b",
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
    {
      input: `ADD https://example.com/a.tgz?token=${PLACEHOLDER} /opt/`,
      output: "ADD https://example.com/a.tgz?*** /opt/",
    },
    {
      input: `curl -https://example.com/p?token=${PLACEHOLDER} 1.https://example.com/q?sig=${PLACEHOLDER}`,
      output: "curl -https://example.com/p?*** 1.https://example.com/q?***",
    },
    {
      input: `ADD https://example.com/pkg(v1).tar.gz?token=${PLACEHOLDER} /tmp/`,
      output: "ADD https://example.com/pkg(v1).tar.gz?*** /tmp/",
    },
    {
      input: `RUN V=$(curl -fsSL https://example.com/y?t=${PLACEHOLDER}) && echo ok`,
      output: "RUN V=$(curl -fsSL https://example.com/y?*** && echo ok",
    },
    {
      input: `curl 'https://b.s3.amazonaws.com/k?X-Amz-Date=1&X-Amz-Signature=${PLACEHOLDER}' -o k`,
      output: "curl 'https://b.s3.amazonaws.com/k?***' -o k",
    },
    {
      input: `curl https://example.com/p?sig=${PLACEHOLDER}&&npm install`,
      output: "curl https://example.com/p?***&&npm install",
    },
    {
      input: `ADD https://ci:${PLACEHOLDER}@example.com/a.bin?v=1#frag /a`,
      output: "ADD https://***@example.com/a.bin?***#frag /a",
    },
    {
      input: `curl -H "Authorization: Bearer ${PLACEHOLDER}" https://example.com`,
      output: 'curl -H "Authorization: ***" https://example.com',
    },
    {
      input: `curl --header 'authorization: Basic ${PLACEHOLDER}' https://example.com`,
      output: "curl --header 'authorization: ***' https://example.com",
    },
    {
      input: `curl -H "Proxy-Authorization:Basic ${PLACEHOLDER}" https://example.com`,
      output: 'curl -H "Proxy-Authorization:***" https://example.com',
    },
    {
      input: `curl -H 'PRIVATE-TOKEN: ${PLACEHOLDER}' https://example.com`,
      output: "curl -H 'PRIVATE-TOKEN: ***' https://example.com",
    },
    {
      input: `wget --header="X-API-Key: ${PLACEHOLDER}" https://example.com`,
      output: 'wget --header="X-API-Key: ***" https://example.com',
    },
    {
      input: `Running 'curl --header 'X-Auth-Token: ${PLACEHOLDER}' https://example.com && npm install' after copying`,
      output:
        "Running 'curl --header 'X-Auth-Token: ***' https://example.com && npm install' after copying",
    },
    {
      input: `curl -u deploy:${PLACEHOLDER} https://example.com`,
      output: "curl -u *** https://example.com",
    },
    {
      input: `curl --user "deploy:${PLACEHOLDER}" https://example.com`,
      output: "curl --user *** https://example.com",
    },
    {
      input: `curl --proxy-user proxy:${PLACEHOLDER} https://example.com`,
      output: "curl --proxy-user *** https://example.com",
    },
    {
      input: `tool --user=deploy:${PLACEHOLDER}`,
      output: "tool --user=***",
    },
    {
      input: `curl -H "X-API-Key: ${PLACEHOLDER}  " https://example.com`,
      output: 'curl -H "X-API-Key: ***" https://example.com',
    },
  ];

  test.each(masked)("masks $output", ({ input, output }) => {
    expect(redactSecrets(input)).toBe(output);
  });

  test.each(masked)("masking $output twice changes nothing", ({ output }) => {
    expect(redactSecrets(output)).toBe(output);
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
    "curl https://example.com/health && npm install",
    "ADD https://example.com/pkg(v1).tar.gz /tmp/",
    "docker run -u 1000:1000 app",
    "docker run --user 0:0 app",
    "su -u app",
    'curl -H "Content-Type: application/json" https://example.com',
    'curl -H "Authorization: Bearer $TOKEN" https://example.com',
    "curl -H 'PRIVATE-TOKEN: $CI_TOKEN' https://example.com",
    'curl -H "X-Auth-Enabled: true" https://example.com',
    "Base image 'auth:1.2' may be a full-OS distribution.",
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
    `ADD https://example.com/a.tgz?token=${PLACEHOLDER} /opt/`,
    "COPY . .",
    `RUN NPM_TOKEN=${PLACEHOLDER} npm ci`,
    `RUN npm config set //registry.npmjs.org/:_authToken=${PLACEHOLDER} && npm install`,
    `RUN pip install --index-url https://__token__:${PLACEHOLDER}@pypi.example.com/simple flask`,
    `RUN yarn install --auth-token ${PLACEHOLDER}`,
    `RUN curl -H "Authorization: Bearer ${PLACEHOLDER}" https://example.com/ping && npm install`,
    `RUN curl --header 'PRIVATE-TOKEN: ${PLACEHOLDER}' https://example.com/ping && npm install`,
    `RUN curl -u deploy:${PLACEHOLDER} https://example.com/pkg && npm install`,
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

// Scanned files can come from a pull request, so a line built to make a
// pattern backtrack must not stall a scan or a CI run.
const ADVERSARIAL_LENGTH = 200_000;
const TIME_LIMIT_MS = 1000;

const adversarialInputs = [
  { name: "a scheme-like run", text: "a.".repeat(ADVERSARIAL_LENGTH / 2) },
  { name: "digits and dots", text: "1.".repeat(ADVERSARIAL_LENGTH / 2) },
  {
    name: "repeated schemes",
    text: "http://".repeat(Math.floor(ADVERSARIAL_LENGTH / 7)),
  },
  {
    name: "repeated URLs with a query",
    text: "https://a?".repeat(ADVERSARIAL_LENGTH / 10),
  },
  {
    name: "ampersands in a query",
    text: `https://a?${"&".repeat(ADVERSARIAL_LENGTH)}`,
  },
  {
    name: "parentheses in a URL query",
    text: `https://a?${"()".repeat(ADVERSARIAL_LENGTH / 2)}`,
  },
  {
    name: "repeated URLs with parentheses",
    text: "https://(a)?(b)".repeat(ADVERSARIAL_LENGTH / 15),
  },
  { name: "repeated -u flags", text: "-u a ".repeat(ADVERSARIAL_LENGTH / 5) },
  { name: "spaces after -u", text: `-u${" ".repeat(ADVERSARIAL_LENGTH)}` },
  {
    name: "repeated header openers",
    text: '"A: b '.repeat(ADVERSARIAL_LENGTH / 6),
  },
  { name: "spaces in a header", text: `"A:${" ".repeat(ADVERSARIAL_LENGTH)}` },
];

describe("redactSecrets on a long adversarial line", () => {
  test.each(adversarialInputs)(
    "finishes 200,000 characters of $name within a second",
    ({ text }) => {
      const start = performance.now();
      redactSecrets(text);
      expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS);
    }
  );
});
