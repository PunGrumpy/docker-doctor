import { describe, expect, test } from "bun:test";

import { parseCompose } from "../src/parsers/compose-parser";
import {
  requireResourceLimits,
  requireRestartPolicy,
} from "../src/rules/compose";

const FILE = "compose.yaml";

const flagged = (yaml: string) => {
  const content = parseCompose(yaml, FILE);

  return {
    limits: requireResourceLimits
      .check(content, FILE)
      .map((diagnostic) => diagnostic.message),
    restart: requireRestartPolicy
      .check(content, FILE)
      .map((diagnostic) => diagnostic.message),
  };
};

describe("provider services and the container absence rules", () => {
  test("a provider service needs no restart policy or limits", () => {
    const { limits, restart } = flagged(`
services:
  database:
    provider:
      type: awesomecloud
      options:
        type: mysql
`);

    expect(limits).toEqual([]);
    expect(restart).toEqual([]);
  });

  test("a Model Runner provider service needs neither", () => {
    const { limits, restart } = flagged(`
services:
  llm:
    provider:
      type: model
      options:
        model: ai/smollm2:360M-Q4_K_M
`);

    expect(limits).toEqual([]);
    expect(restart).toEqual([]);
  });

  test("a normal service beside a provider service is still checked", () => {
    const { limits, restart } = flagged(`
services:
  app:
    image: myapp:1.0
  database:
    provider:
      type: awesomecloud
`);

    expect(limits).toHaveLength(1);
    expect(limits[0]).toContain("'app'");
    expect(restart).toHaveLength(1);
    expect(restart[0]).toContain("'app'");
  });

  test("a provider key that is not a mapping does not exempt the service", () => {
    for (const provider of ["null", '"x"', "[a, b]"]) {
      const { limits, restart } = flagged(`
services:
  database:
    image: mysql:8
    provider: ${provider}
`);

      expect(limits).toHaveLength(1);
      expect(restart).toHaveLength(1);
    }
  });
});
