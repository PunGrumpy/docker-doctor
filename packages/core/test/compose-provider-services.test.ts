import { describe, expect, test } from "bun:test";

import { parseCompose, readComposeFile } from "../src/parsers/compose-parser";
import {
  requireResourceLimits,
  requireRestartPolicy,
  useDependsOnCondition,
} from "../src/rules/compose";
import { runComposeFiles } from "../src/runners/compose-runner";

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

const dependsOnFlagged = (yaml: string) =>
  useDependsOnCondition.check(parseCompose(yaml, FILE), FILE).length;

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

describe("provider services and use-depends-on-condition", () => {
  test("a list that names only a provider service is accepted", () => {
    expect(
      dependsOnFlagged(`
services:
  app:
    image: myapp:1.0
    depends_on:
      - database
  database:
    provider:
      type: awesomecloud
`)
    ).toBe(0);
  });

  test("a list that also names an ordinary service is reported", () => {
    expect(
      dependsOnFlagged(`
services:
  app:
    image: myapp:1.0
    depends_on:
      - database
      - cache
  database:
    provider:
      type: awesomecloud
  cache:
    image: redis:7
`)
    ).toBe(1);
  });

  test("a list that names an undeclared service is reported", () => {
    expect(
      dependsOnFlagged(`
services:
  app:
    image: myapp:1.0
    depends_on:
      - database
      - ghost
  database:
    provider:
      type: awesomecloud
`)
    ).toBe(1);
  });

  test("an item that is not a string counts as an ordinary service", () => {
    expect(
      dependsOnFlagged(`
services:
  app:
    image: myapp:1.0
    depends_on:
      - database
      - 7
  database:
    provider:
      type: awesomecloud
`)
    ).toBe(1);
  });

  test("a provider declared in the project is seen from the override", () => {
    const override = parseCompose(
      "services:\n  app:\n    depends_on:\n      - database\n",
      "compose.override.yaml"
    );

    const project = parseCompose(
      "services:\n  app:\n    image: myapp:1.0\n  database:\n    provider:\n      type: awesomecloud\n",
      FILE
    );

    expect(
      useDependsOnCondition.check(override, FILE, { project })
    ).toHaveLength(0);
    expect(useDependsOnCondition.check(override, FILE)).toHaveLength(1);
  });
});

describe("use-depends-on-condition across a base file and its override", () => {
  const OVERRIDE = "compose.override.yaml";
  const RULE = "docker-doctor/use-depends-on-condition";

  const overrideYaml = "services:\n  app:\n    depends_on:\n      - database\n";

  const findingsFor = (baseYaml: string) => {
    const results = runComposeFiles([
      { compose: readComposeFile(baseYaml, FILE), file: FILE },
      { compose: readComposeFile(overrideYaml, OVERRIDE), file: OVERRIDE },
    ]);

    const rules = (file: string) =>
      (results.get(file) ?? []).map((diagnostic) => diagnostic.rule);

    return { base: rules(FILE), override: rules(OVERRIDE) };
  };

  test("a provider service the base declares serves the override", () => {
    const { base, override } = findingsFor(
      "services:\n  app:\n    image: myapp:1.0\n  database:\n    provider:\n      type: awesomecloud\n"
    );

    expect(base).not.toContain(RULE);
    expect(override).not.toContain(RULE);
  });

  test("an ordinary service the base declares is still reported on the override", () => {
    const { override } = findingsFor(
      "services:\n  app:\n    image: myapp:1.0\n  database:\n    image: mysql:8\n"
    );

    expect(override).toContain(RULE);
  });
});
