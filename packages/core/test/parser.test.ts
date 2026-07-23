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
});
