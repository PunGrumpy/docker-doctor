import { describe, expect, test } from "bun:test";

import { parseExecForm } from "../src/parsers/exec-form";

describe("parseExecForm", () => {
  test("JSON string array is exec form", () => {
    expect(parseExecForm('["node", "index.js"]')).toEqual(["node", "index.js"]);
  });

  test("surrounding whitespace is ignored", () => {
    expect(parseExecForm('  ["node"]  ')).toEqual(["node"]);
  });

  test("empty array is still exec form", () => {
    expect(parseExecForm("[]")).toEqual([]);
  });

  test("bracket-wrapped but unquoted tokens are shell form", () => {
    expect(parseExecForm("[node, index.js]")).toBeNull();
  });

  test("single-quoted elements are shell form", () => {
    expect(parseExecForm("['node', 'index.js']")).toBeNull();
  });

  test("trailing comma is shell form", () => {
    expect(parseExecForm('["node", "index.js",]')).toBeNull();
  });

  test("unterminated array is shell form", () => {
    expect(parseExecForm('["node", "index.js"')).toBeNull();
  });

  test("plain command is shell form", () => {
    expect(parseExecForm("node index.js")).toBeNull();
  });

  test("non-array JSON is shell form", () => {
    expect(parseExecForm('{"cmd": "node"}')).toBeNull();
  });

  test("array holding a non-string element is not exec form", () => {
    expect(parseExecForm("[1, 2]")).toBeNull();
    expect(parseExecForm('["node", null]')).toBeNull();
  });
});
