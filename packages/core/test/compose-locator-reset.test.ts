import { describe, expect, test } from "bun:test";

import {
  createComposeLocator,
  readComposeFile,
} from "../src/parsers/compose-parser";

describe("createComposeLocator with !reset", () => {
  test("a sequence index skips a !reset item the parsed document drops", () => {
    const source = [
      "services:",
      "  web:",
      "    image: nginx",
      "    ports:",
      '      - !reset "1:1"',
      '      - "80:80"',
      "",
    ].join("\n");

    const { document } = readComposeFile(source, "compose.yml");
    const locate = createComposeLocator(source);

    expect(document).toMatchObject({
      services: { web: { ports: ["80:80"] } },
    });
    expect(locate(["services", "web", "ports", 0])).toBe(6);
    expect(locate(["services", "web", "ports", 1])).toBeUndefined();
  });

  test("a mapping key whose value is !reset still resolves to its own line", () => {
    const source = [
      "services:",
      "  web:",
      "    image: nginx",
      "    environment:",
      "      A: !reset null",
      "      B: b",
      "",
    ].join("\n");

    const locate = createComposeLocator(source);

    expect(locate(["services", "web", "environment", "A"])).toBe(5);
    expect(locate(["services", "web", "environment", "B"])).toBe(6);
  });

  test("items without !reset keep their own lines", () => {
    const source = [
      "services:",
      "  web:",
      "    ports:",
      '      - "80:80"',
      '      - "443:443"',
      "",
    ].join("\n");

    const locate = createComposeLocator(source);

    expect(locate(["services", "web", "ports", 0])).toBe(4);
    expect(locate(["services", "web", "ports", 1])).toBe(5);
  });

  test("an !override item stays addressable", () => {
    const source = [
      "services:",
      "  web:",
      "    ports: !override",
      '      - "80:80"',
      "",
    ].join("\n");

    const locate = createComposeLocator(source);

    expect(locate(["services", "web", "ports", 0])).toBe(4);
  });
});
