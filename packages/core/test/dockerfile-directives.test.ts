import { describe, expect, test } from "bun:test";

import { parseDockerfileDirectives } from "../src/parsers/dockerfile-directives";

describe("parseDockerfileDirectives", () => {
  const cases = [
    {
      content: "# syntax=docker/dockerfile:1\nFROM alpine:3.20",
      expected: { line: 1, value: "docker/dockerfile:1" },
      name: "first line",
    },
    {
      content: "#   syntax = docker/dockerfile:1  \nFROM alpine:3.20",
      expected: { line: 1, value: "docker/dockerfile:1" },
      name: "whitespace around the key and value",
    },
    {
      content: "#syntax=docker/dockerfile:1\nFROM alpine:3.20",
      expected: { line: 1, value: "docker/dockerfile:1" },
      name: "no space after the hash",
    },
    {
      content: "# SYNTAX=docker/dockerfile:1\nFROM alpine:3.20",
      expected: { line: 1, value: "docker/dockerfile:1" },
      name: "upper-case key",
    },
    {
      content: "# escape=`\n# syntax=docker/dockerfile:1\nFROM alpine:3.20",
      expected: { line: 2, value: "docker/dockerfile:1" },
      name: "escape before syntax",
    },
    {
      content: "# check=skip=all\n# syntax=docker/dockerfile:1\nFROM alpine",
      expected: { line: 2, value: "docker/dockerfile:1" },
      name: "check before syntax",
    },
    {
      content: "# syntax=first/frontend\n# syntax=second/frontend\nFROM alpine",
      expected: { line: 1, value: "first/frontend" },
      name: "the first of two syntax lines",
    },
    {
      content: "# syntax=docker/dockerfile:1\r\nFROM alpine:3.20",
      expected: { line: 1, value: "docker/dockerfile:1" },
      name: "CRLF line endings",
    },
    {
      content: "\n# syntax=docker/dockerfile:1\nFROM alpine:3.20",
      expected: null,
      name: "blank line before it",
    },
    {
      content: "# build image\n# syntax=docker/dockerfile:1\nFROM alpine",
      expected: null,
      name: "plain comment before it",
    },
    {
      content: "# vendor=acme\n# syntax=docker/dockerfile:1\nFROM alpine",
      expected: null,
      name: "unknown key before it",
    },
    {
      content: "FROM alpine\n# syntax=docker/dockerfile:1",
      expected: null,
      name: "after an instruction",
    },
    {
      content: " # syntax=docker/dockerfile:1\nFROM alpine",
      expected: null,
      name: "indented hash",
    },
    {
      content: "# syntax=\nFROM alpine",
      expected: null,
      name: "empty value",
    },
    { content: "", expected: null, name: "empty file" },
  ];

  test.each(cases)("$name", ({ content, expected }) => {
    expect(parseDockerfileDirectives(content).syntax ?? null).toEqual(expected);
  });
});
