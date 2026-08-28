import { describe, test, expect } from "bun:test";

import { parseCompose } from "../src/parsers/compose-parser";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";

describe("Dockerfile Parser", () => {
  test("should parse simple Dockerfile instruction", () => {
    const content = `
      FROM node:22-alpine
      WORKDIR /app
      COPY . .
      RUN npm install
      CMD ["node", "index.js"]
    `;
    const insts = parseDockerfile(content);
    expect(insts).toHaveLength(5);
    expect(insts[0].instruction).toBe("FROM");
    expect(insts[0].args).toBe("node:22-alpine");
    expect(insts[1].instruction).toBe("WORKDIR");
    expect(insts[1].args).toBe("/app");
    expect(insts[2].instruction).toBe("COPY");
    expect(insts[2].args).toBe(". .");
    expect(insts[3].instruction).toBe("RUN");
    expect(insts[3].args).toBe("npm install");
    expect(insts[4].instruction).toBe("CMD");
    expect(insts[4].args).toBe('["node", "index.js"]');
  });

  test("should handle multi-line instructions", () => {
    const content = `
      RUN apt-get update && \\
          apt-get install -y curl && \\
          rm -rf /var/lib/apt/lists/*
    `;
    const insts = parseDockerfile(content);
    expect(insts).toHaveLength(1);
    expect(insts[0].instruction).toBe("RUN");
    expect(insts[0].args).toBe(
      "apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*"
    );
  });

  test("ignores non-instruction lines", () => {
    const parsed = parseDockerfile(`
      FROM node:22
      this is not an instruction
    `);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].instruction).toBe("FROM");
  });

  test("accepts lowercase instructions", () => {
    const parsed = parseDockerfile(`
      from node:22
      run echo hi
    `);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].instruction).toBe("FROM");
    expect(parsed[1].instruction).toBe("RUN");
  });

  test("parses heredoc bodies into the owning instruction", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN <<EOF
apt-get update
apt-get install -y curl
EOF
USER node
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].instruction).toBe("FROM");
    expect(parsed[1].instruction).toBe("RUN");
    expect(parsed[1].args).toContain("apt-get install -y curl");
    expect(parsed[2].instruction).toBe("USER");
  });

  test("does not treat heredoc body lines as instructions", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN <<EOF
USER root
EOF
    `);
    expect(parsed).toHaveLength(2);
    expect(parsed.some((i) => i.instruction === "USER")).toBe(false);
  });

  test("handles quoted and dash heredoc delimiters", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN <<-'EOT'
echo hello
EOT
    `);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].args).toContain("echo hello");
  });

  test("preserves heredoc body in raw", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN <<EOF
echo hello
EOF
    `);
    expect(parsed[1].raw).toContain("echo hello");
  });

  test("keeps comment lines inside a continuation out of raw and args", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN apt-get update && apt-get install -y \\
  curl \\
  # tools below are build-only
  git \\
  tmux
    `);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].args).toBe(
      "apt-get update && apt-get install -y curl git tmux"
    );
    expect(parsed[1].raw).not.toContain("build-only");
  });

  test("keeps comment-looking lines inside a heredoc body in raw", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN <<EOF
# this is shell content, not a Dockerfile comment
echo hello
EOF
    `);
    expect(parsed[1].raw).toContain("# this is shell content");
  });

  test("handles CRLF line endings", () => {
    const parsed = parseDockerfile("FROM node:22\r\nUSER node\r\n");
    expect(parsed).toHaveLength(2);
    expect(parsed[1].instruction).toBe("USER");
  });

  test("does not treat shell arithmetic << as a heredoc opener", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN echo $((1<<3))
USER node
LABEL a=b
CMD ["node"]
    `);
    expect(parsed).toHaveLength(5);
    expect(parsed.some((i) => i.instruction === "USER")).toBe(true);
  });

  test("does not treat spaced shell arithmetic << as a heredoc opener", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN echo $((1 << 3))
USER node
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed.some((i) => i.instruction === "USER")).toBe(true);
  });

  test("does not treat a here-string <<< as a heredoc opener", () => {
    const parsed = parseDockerfile(`
FROM node:22
RUN grep foo <<< "bar"
USER node
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed.some((i) => i.instruction === "USER")).toBe(true);
  });

  test("handles multiple heredocs opened on one COPY line, closed in FIFO order", () => {
    const parsed = parseDockerfile(`
FROM node:22
COPY <<F1 <<F2 /dest/
body one
F1
body two
F2
USER node
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed[1].instruction).toBe("COPY");
    expect(parsed[1].args).toContain("body one");
    expect(parsed[1].args).toContain("body two");
    expect(parsed.some((i) => i.instruction === "USER")).toBe(true);
  });

  test("does not treat << on non-heredoc instructions as a heredoc opener", () => {
    const parsed = parseDockerfile(`
FROM node:22
ENV DOC="a<<b"
USER node
    `);
    expect(parsed).toHaveLength(3);
    expect(parsed.some((i) => i.instruction === "USER")).toBe(true);
  });
});

describe("Compose Parser", () => {
  test("should parse compose yml content", () => {
    const content = `
services:
  web:
    image: node:22
    ports:
      - "3000:3000"
    `;
    const compose = parseCompose(content, "docker-compose.yml") as {
      services: Record<string, { image?: string }>;
    };
    expect(compose.services).toBeDefined();
    expect(compose.services.web).toBeDefined();
    expect(compose.services.web.image).toBe("node:22");
  });

  test("resolves merge keys (<<: *anchor)", () => {
    const content = `
x-base: &base
  restart: always
  deploy:
    resources:
      limits:
        memory: 256M
services:
  web:
    <<: *base
    image: nginx
    `;
    const compose = parseCompose(content, "docker-compose.yml") as {
      services: Record<string, { restart?: string }>;
    };
    expect(compose.services.web.restart).toBe("always");
    expect("<<" in compose.services.web).toBe(false);
  });

  test("resolves plain aliases (no merge key)", () => {
    const content = `
services:
  a:
    environment: &env
      FOO: "1"
  b:
    environment: *env
    `;
    const compose = parseCompose(content, "docker-compose.yml") as {
      services: Record<string, { environment?: { FOO?: string } }>;
    };
    expect(compose.services.b.environment?.FOO).toBe("1");
  });
});
