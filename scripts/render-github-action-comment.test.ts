import { describe, expect, test } from "bun:test";

import { sanitizeMessage as sanitizeCliMessage } from "../packages/docker-doctor/src/agents/sanitize";
import {
  readContext,
  readReportText,
  renderComment,
  renderFailure,
  renderReport,
  safeLabel,
  sanitizeProse,
  sanitizeText,
} from "./render-github-action-comment.mjs";

interface TestReport {
  diagnostics: {
    category: string;
    file: string;
    help: string;
    line?: number;
    message: string;
    rule: string;
    severity: "error" | "warning" | "info";
  }[];
  failures?: { file: string; message: string }[];
  label: unknown;
  project: { composeFiles: string[]; dockerfiles: string[] };
  schemaVersion: number;
  score: unknown;
  timestamp: string;
}

const HEREDOC_FAILURE = {
  file: "Dockerfile",
  message:
    'Unterminated heredoc: delimiter "EOF" (opened on line 2) never closed. BuildKit rejects this Dockerfile too.',
};

const makeReport = (overrides: Partial<TestReport> = {}): TestReport => ({
  diagnostics: [],
  failures: [],
  label: "Excellent 🏆",
  project: { composeFiles: [], dockerfiles: ["Dockerfile"] },
  schemaVersion: 4,
  score: 100,
  timestamp: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// A report as schema 3 wrote it, before the failures list existed.
const makeReportWithoutFailures = (
  overrides: Partial<TestReport> = {}
): TestReport => {
  const report = makeReport(overrides);

  delete report.failures;

  return report;
};

const diagnostic = (
  severity: TestReport["diagnostics"][number]["severity"]
): TestReport["diagnostics"][number] => ({
  category: "Security",
  file: "Dockerfile",
  help: "Fix it.",
  line: 1,
  message: `A ${severity} finding.`,
  rule: "docker-doctor/no-root-user",
  severity,
});

// Goes through readReportText like the action does, so every case also
// covers the parsing and normalization of the untrusted report file.
const parseReport = (report: TestReport) => {
  const parsed = readReportText(JSON.stringify(report));

  if (parsed === null) {
    throw new Error("test report failed validation");
  }

  return parsed;
};

const render = (env: Record<string, string>, report: TestReport) =>
  renderReport(
    readContext({
      DOCTOR_HEAD_SHA: "abcdef1234567",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REPOSITORY: "o/r",
      ...env,
    }),
    parseReport(report)
  );

const manyFiles = (count: number, directory: string): TestReport => {
  const dockerfiles = Array.from(
    { length: count },
    (_, index) => `${directory}${index}/Dockerfile`
  );

  return makeReport({
    diagnostics: dockerfiles.map((file) => ({
      ...diagnostic("warning"),
      file,
    })),
    label: "Critical 🚨",
    project: { composeFiles: [], dockerfiles },
    score: 0,
  });
};

const dockerfileRow = (body: string): string | undefined =>
  body.split("\n").find((line) => line.startsWith("| [`Dockerfile`]"));

describe("gate and commit status", () => {
  test("a clean report passes with blocking none", () => {
    const { body, outputs } = render({ DOCTOR_BLOCKING: "none" }, makeReport());
    expect(body).toContain("Clean");
    expect(outputs["gate-status"]).toBe("0");
    expect(outputs["status-state"]).toBe("success");
  });

  test("an error fails blocking error and expands the findings", () => {
    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "error" },
      makeReport({ diagnostics: [diagnostic("error")] })
    );

    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-state"]).toBe("failure");
    expect(body).toContain("<details open>");
  });

  test("a warning fails blocking warning but not blocking error", () => {
    const report = makeReport({ diagnostics: [diagnostic("warning")] });
    expect(
      render({ DOCTOR_BLOCKING: "error" }, report).outputs["gate-status"]
    ).toBe("0");
    expect(
      render({ DOCTOR_BLOCKING: "warning" }, report).outputs["gate-status"]
    ).toBe("1");
  });
});

describe("incomplete scans", () => {
  test("a file listed in failures is Unanalyzed and fails the check", () => {
    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "none", DOCTOR_EXIT_STATUS: "2" },
      makeReport({ failures: [HEREDOC_FAILURE] })
    );

    expect(body).toContain("Unanalyzed");
    expect(body).toContain("1 file could not be analyzed");
    expect(dockerfileRow(body)).not.toContain("Clean");
    expect(dockerfileRow(body)).toContain("Unterminated heredoc");
    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-state"]).toBe("failure");
    expect(outputs["status-description"]).toContain("1 unanalyzed");
  });

  test("an unanalyzed file sorts above files with errors", () => {
    const { body } = render(
      { DOCTOR_BLOCKING: "none" },
      makeReport({
        diagnostics: [{ ...diagnostic("error"), file: "api/Dockerfile" }],
        failures: [HEREDOC_FAILURE],
        project: {
          composeFiles: [],
          dockerfiles: ["api/Dockerfile", "Dockerfile"],
        },
      })
    );

    const rows = body.split("\n").filter((line) => line.startsWith("| [`"));
    expect(rows[0]).toContain("Unanalyzed");
    expect(rows[1]).toContain("Error");
  });

  test("a schema 3 report with exit status 2 still fails the check", () => {
    const schema3 = makeReportWithoutFailures({ schemaVersion: 3 });

    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "none", DOCTOR_EXIT_STATUS: "2" },
      schema3
    );

    expect(body).toContain("Some files could not be analyzed");
    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-description"]).toContain("scan incomplete");
  });

  test("a schema 3 report with exit status 0 renders as complete", () => {
    const schema3 = makeReportWithoutFailures({ schemaVersion: 3 });

    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "none", DOCTOR_EXIT_STATUS: "0" },
      schema3
    );

    expect(body).not.toContain("could not be analyzed");
    expect(outputs["gate-status"]).toBe("0");
  });

  test("on a push the gate fails but the commit status stays advisory", () => {
    const { outputs } = render(
      { DOCTOR_BLOCKING: "none", GITHUB_EVENT_NAME: "push" },
      makeReport({ failures: [HEREDOC_FAILURE] })
    );

    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-state"]).toBe("success");
  });
});

// Schema 6: the CLI analyzed none of the discovered files.
const unscored = (failures: TestReport["failures"]) =>
  makeReport({
    failures,
    label: null,
    project: { composeFiles: ["compose.yaml"], dockerfiles: ["Dockerfile"] },
    schemaVersion: 6,
    score: null,
  });

describe("reports with no score", () => {
  const COMPOSE_FAILURE = {
    file: "compose.yaml",
    message: "Flow sequence in block collection must end with a ]",
  };

  test("every file failed: empty score and label, and an error status", () => {
    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "none", DOCTOR_EXIT_STATUS: "2" },
      unscored([HEREDOC_FAILURE, COMPOSE_FAILURE])
    );

    expect(body).toContain("**No score.**");
    expect(body).not.toContain("/ 100");
    expect(outputs.score).toBe("");
    expect(outputs.label).toBe("");
    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-state"]).toBe("error");
    expect(outputs["status-description"]).toBe("No score · 2 unanalyzed");
  });

  test("on a push the status is an error too, not advisory success", () => {
    const { outputs } = render(
      { DOCTOR_EXIT_STATUS: "2", GITHUB_EVENT_NAME: "push" },
      unscored([HEREDOC_FAILURE, COMPOSE_FAILURE])
    );

    expect(outputs["status-state"]).toBe("error");
  });

  test("files with nothing to check pass with no score", () => {
    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "warning", DOCTOR_EXIT_STATUS: "0" },
      unscored([])
    );

    expect(body).toContain(
      "None of the discovered files has anything to check"
    );
    expect(outputs.score).toBe("");
    expect(outputs["gate-status"]).toBe("0");
    expect(outputs["status-state"]).toBe("success");
    expect(outputs["status-description"]).toBe("No score");
  });

  test("an empty project leaves score and label empty", () => {
    const { body, outputs } = render(
      { DOCTOR_BLOCKING: "warning", DOCTOR_EXIT_STATUS: "0" },
      makeReport({
        label: null,
        project: { composeFiles: [], dockerfiles: [] },
        schemaVersion: 6,
        score: null,
      })
    );

    expect(body).toContain("found no Dockerfiles or Compose files");
    expect(outputs.score).toBe("");
    expect(outputs.label).toBe("");
    expect(outputs["status-state"]).toBe("success");
    expect(outputs["status-description"]).toBe(
      "No Dockerfiles or Compose files found"
    );
  });

  test("readReportText accepts a null score only with a null label", () => {
    expect(readReportText(JSON.stringify(unscored([])))?.score).toBeNull();
    expect(
      readReportText(JSON.stringify(makeReport({ score: null })))
    ).toBeNull();
    expect(
      readReportText(JSON.stringify(makeReport({ label: null })))
    ).toBeNull();
  });
});

describe("untrusted report fields", () => {
  test("a forged score and label never reach the comment or outputs", () => {
    // readReportText already rejects a string score; renderReport must not
    // rely on that, so this case skips the parser.
    const { body, outputs } = renderReport(
      readContext({ GITHUB_EVENT_NAME: "pull_request" }),
      {
        ...makeReport({ label: "<img src=x>", score: "99](https://evil)" }),
        failures: [],
      }
    );

    expect(body).not.toContain("evil");
    expect(body).not.toContain("<img");
    expect(outputs.score).toBe("0");
    expect(outputs.label).toBe("");
    expect(outputs["status-description"]).not.toContain("evil");
  });

  test("an out-of-range score is clamped to 0-100", () => {
    const { body, outputs } = render({}, makeReport({ score: 1e9 }));
    expect(body).toContain("[100 / 100]");
    expect(outputs.score).toBe("100");
  });

  test("readReportText rejects anything that is not a report", () => {
    expect(readReportText("not json")).toBeNull();
    expect(readReportText("null")).toBeNull();
    expect(readReportText(JSON.stringify({ diagnostics: [] }))).toBeNull();
    expect(
      readReportText(JSON.stringify(makeReport({ score: "100" })))
    ).toBeNull();
  });

  test("readReportText defaults a missing failures list to empty", () => {
    const schema3 = makeReportWithoutFailures();
    expect(readReportText(JSON.stringify(schema3))?.failures).toEqual([]);
  });

  test("sanitizeText neutralizes markdown, HTML and control characters", () => {
    const sanitized = sanitizeText("a`b|c<d[e]f\ng\u001B[2Kh");
    expect(sanitized).toBe("a'b\\|c&lt;d\\[e\\]f g \\[2Kh");
  });

  // Written as escapes because the characters are invisible in an editor.
  const invisibleSamples = [
    "\u0085",
    "\u2028",
    "\u2029",
    "\u200B",
    "\u200F",
    "\u202A",
    "\u202E",
    "\u2066",
    "\u2069",
    "\uFEFF",
    "\u{E0000}",
    "\u{E0041}",
  ];

  test.each(invisibleSamples)(
    "sanitizeText and the CLI sanitizer both turn %p into a space",
    (char) => {
      expect(sanitizeText(`a${char}b`)).toBe("a b");
      expect(sanitizeCliMessage(`a${char}b`)).toBe("a b");
    }
  );

  test("sanitizeProse shows mentions, references and URLs as code", () => {
    expect(
      sanitizeProse(
        "ping @octocat and @org/team about #12, o/r#3 and GH-4 at https://x.test/a|b or www.x.test"
      )
    ).toBe(
      "ping `@octocat` and `@org/team` about `#12,` `o/r#3` and `GH-4` at `https://x.test/a\\|b` or `www.x.test`"
    );
  });

  test("sanitizeProse escapes markdown outside the code spans", () => {
    expect(sanitizeProse("a`b [c] <d> @e`f")).toBe("a'b \\[c\\] &lt;d> `@e'f`");
  });

  test("a message cannot mention, reference or link from the comment", () => {
    const message = "Ping @octocat about #1 at https://phish.test.\u202E txet";

    const { body } = render(
      {},
      makeReport({
        diagnostics: [{ ...diagnostic("warning"), message }],
        failures: [{ file: "compose.yaml", message }],
        project: {
          composeFiles: ["compose.yaml"],
          dockerfiles: ["Dockerfile"],
        },
      })
    );

    expect(body).not.toContain("\u202E");
    expect(body).not.toMatch(/[^`]@octocat/u);
    expect(body).not.toMatch(/[^`]#1\b/u);
    expect(body).not.toMatch(/[^`]https:\/\/phish/u);
    expect(body).toContain(
      "Ping `@octocat` about `#1` at `https://phish.test.`"
    );
  });

  test("file links percent-encode #, ? and % in each path segment", () => {
    const file = "svc #1/a#b?c%20(x).dockerfile";

    const { body } = render(
      {},
      makeReport({
        diagnostics: [{ ...diagnostic("warning"), file, line: 3 }],
        project: { composeFiles: [], dockerfiles: [file] },
      })
    );

    expect(body).toContain(
      "](https://github.com/o/r/blob/abcdef1234567/svc%20%231/a%23b%3Fc%2520%28x%29.dockerfile#L3)"
    );
  });

  test("safeLabel keeps only the known score buckets", () => {
    expect(safeLabel("Good ✅")).toBe("Good");
    expect(safeLabel("Bogus")).toBe("");
  });
});

describe("comment size", () => {
  // GitHub rejects an issue comment longer than this.
  const GITHUB_COMMENT_LIMIT = 65_536;

  const context = readContext({
    DOCTOR_HEAD_SHA: "abcdef1234567",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "o/r",
  });

  test("a small report is the same in the comment and the job summary", () => {
    const report = parseReport(
      makeReport({ diagnostics: [diagnostic("warning")] })
    );

    expect(renderComment(context, report).body).toBe(
      renderReport(context, report).body
    );
  });

  test("a 300-file report drops table rows until the comment fits", () => {
    const report = parseReport(manyFiles(300, "services/svc"));
    const full = renderReport(context, report);
    const comment = renderComment(context, report);

    expect(full.body.length).toBeGreaterThan(GITHUB_COMMENT_LIMIT);
    expect(comment.body.length).toBeLessThanOrEqual(GITHUB_COMMENT_LIMIT);
    expect(comment.body).toContain("more files not listed here");
    expect(comment.body).toContain("**Score:**");
    // The gate and the counts never depend on how much was rendered.
    expect(comment.outputs).toEqual(full.outputs);
  });

  test("very long paths fall back to the score line", () => {
    const report = parseReport(
      manyFiles(300, "long-directory-name-".repeat(15))
    );

    const comment = renderComment(context, report);

    expect(comment.body.length).toBeLessThanOrEqual(GITHUB_COMMENT_LIMIT);
    expect(comment.body).toContain("too long for a comment");
    expect(comment.body).toContain("0 errors · 300 warnings");
    expect(comment.outputs["warning-count"]).toBe("300");
  });
});

describe("renderFailure", () => {
  test("a missing report fails the check", () => {
    const { body, outputs } = renderFailure(
      readContext({ GITHUB_EVENT_NAME: "pull_request" })
    );

    expect(body).toContain("could not produce a scan report");
    expect(outputs["gate-status"]).toBe("1");
    expect(outputs["status-state"]).toBe("failure");
  });
});
