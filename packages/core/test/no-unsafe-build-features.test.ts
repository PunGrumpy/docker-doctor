import { describe, expect, test } from "bun:test";

import { parseDockerfileDirectives } from "../src/parsers/dockerfile-directives";
import { parseDockerfile } from "../src/parsers/dockerfile-parser";
import { noUnsafeBuildFeatures } from "../src/rules/security";
import { runDockerfileRules } from "../src/runners/dockerfile-runner";

const RULE = "docker-doctor/no-unsafe-build-features";

const check = (content: string) =>
  noUnsafeBuildFeatures.check(parseDockerfile(content), "Dockerfile", {
    directives: parseDockerfileDirectives(content),
  });

describe("no-unsafe-build-features frontends", () => {
  const trusted = [
    "docker/dockerfile:1",
    "docker/dockerfile:1.7-labs",
    "docker/dockerfile",
    "docker/dockerfile-upstream:master",
    "docker.io/docker/dockerfile:1",
    "index.docker.io/docker/dockerfile:1",
    "attacker.example/frontend@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ];

  test.each(trusted)("accepts %s", (frontend) => {
    expect(check(`# syntax=${frontend}\nFROM alpine:3.20`)).toHaveLength(0);
  });

  const untrusted = [
    "attacker.example/frontend:latest",
    "ghcr.io/docker/dockerfile:1",
    "docker/dockerfile-evil:1",
    "someone/dockerfile:1",
    "attacker.example/frontend@latest",
  ];

  test.each(untrusted)("reports %s", (frontend) => {
    const diagnostics = check(`# syntax=${frontend}\nFROM alpine:3.20`);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.line).toBe(1);
    expect(diagnostics[0]?.severity).toBe("warning");
    expect(diagnostics[0]?.message).toBe(
      `Dockerfile selects BuildKit frontend '${frontend}'. A frontend runs with access to the build, so an untrusted one can read or change what it builds.`
    );
  });

  test("reports the line of the directive", () => {
    const diagnostics = check(
      "# escape=`\n# syntax=attacker.example/frontend\nFROM alpine:3.20"
    );

    expect(diagnostics.map((d) => d.line)).toEqual([2]);
  });

  test("reports nothing without a directive", () => {
    expect(check("FROM alpine:3.20")).toHaveLength(0);
  });

  test("reports nothing when no directives are passed", () => {
    expect(
      noUnsafeBuildFeatures.check(
        parseDockerfile("# syntax=attacker.example/frontend\nFROM alpine:3.20"),
        "Dockerfile"
      )
    ).toHaveLength(0);
  });

  test("ignores a directive that is not at the top of the file", () => {
    expect(
      check("# build image\n# syntax=attacker.example/frontend\nFROM alpine")
    ).toHaveLength(0);
    expect(
      check("FROM alpine\n# syntax=attacker.example/frontend")
    ).toHaveLength(0);
  });
});

describe("no-unsafe-build-features RUN flags", () => {
  test("reports --security=insecure and --network=host", () => {
    const diagnostics = check(
      [
        "FROM alpine:3.20",
        "RUN --security=insecure echo one",
        "RUN --network=host echo two",
      ].join("\n")
    );

    expect(diagnostics.map((d) => [d.line, d.message])).toEqual([
      [
        2,
        "RUN uses --security=insecure, which removes build isolation for this step.",
      ],
      [
        3,
        "RUN uses --network=host, which removes build isolation for this step.",
      ],
    ]);
  });

  test("reports both flags on one RUN", () => {
    const diagnostics = check(
      "FROM alpine:3.20\nRUN --security=insecure --network=host echo hi"
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((d) => d.line === 2)).toBe(true);
  });

  test("reports a flag that follows --mount", () => {
    const diagnostics = check(
      "FROM alpine:3.20\nRUN --mount=type=cache,target=/root/.cache --network=host make"
    );

    expect(diagnostics).toHaveLength(1);
  });

  test("ignores safe flags", () => {
    expect(
      check(
        "FROM alpine:3.20\nRUN --network=none --security=sandbox --mount=type=cache,target=/c make"
      )
    ).toHaveLength(0);
  });

  test("ignores a flag in the command", () => {
    expect(
      check(
        "FROM alpine:3.20\nRUN docker run --network=host x\nRUN make --security=insecure"
      )
    ).toHaveLength(0);
  });

  test("ignores a flag on another instruction", () => {
    expect(check("FROM alpine:3.20\nCOPY --network=host a b")).toHaveLength(0);
  });
});

describe("no-unsafe-build-features through the runner", () => {
  test("a comment-only file stays unanalyzed", () => {
    const content = "# syntax=attacker.example/frontend";

    expect(
      runDockerfileRules(
        parseDockerfile(content),
        "Dockerfile",
        [],
        undefined,
        undefined,
        parseDockerfileDirectives(content)
      )
    ).toHaveLength(0);
  });

  test("passes the directives to the rule and applies the configured severity", () => {
    const content = "# syntax=attacker.example/frontend\nFROM alpine:3.20";

    const diagnostics = runDockerfileRules(
      parseDockerfile(content),
      "Dockerfile",
      [],
      { [RULE]: "error" },
      undefined,
      parseDockerfileDirectives(content)
    ).filter((d) => d.rule === RULE);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe("error");
    expect(diagnostics[0]?.category).toBe("Security");
  });

  test("can be turned off", () => {
    const content = "# syntax=attacker.example/frontend\nFROM alpine:3.20";

    expect(
      runDockerfileRules(
        parseDockerfile(content),
        "Dockerfile",
        [],
        { [RULE]: "off" },
        undefined,
        parseDockerfileDirectives(content)
      ).some((d) => d.rule === RULE)
    ).toBe(false);
  });
});
