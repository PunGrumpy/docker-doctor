import { describe, expect, spyOn, test } from "bun:test";

import type { Diagnostic } from "@docker-doctor/core";

import { formatTerminal } from "../src/formatters/terminal";

const LINE_COUNT = 20_000;
const FINDING_COUNT = 5000;
const FINDING_SPACING = LINE_COUNT / FINDING_COUNT;
const SCORE = 50;

// Splitting the file again for every finding takes about 4 seconds on this
// input. One split per file takes about 0.1 second. The bound is loose
// because CI runners are several times slower than a laptop.
const VERBOSE_BUDGET_MS = 1000;

describe("verbose code frames", () => {
  test("a long file with many findings prints without re-reading it per finding", async () => {
    const file = "Dockerfile";

    const content = Array.from(
      { length: LINE_COUNT },
      (_, index) => `RUN echo step-${index + 1}`
    ).join("\n");

    const diagnostics: Diagnostic[] = Array.from(
      { length: FINDING_COUNT },
      (_, index) => ({
        file,
        help: "Combine the steps.",
        line: (index + 1) * FINDING_SPACING,
        message: "Too many layers.",
        rule: "docker-doctor/minimize-layers",
        severity: "warning",
      })
    );

    const printed: string[] = [];

    const log = spyOn(console, "log").mockImplementation((text?: string) => {
      printed.push(text ?? "");
    });

    const startedAt = performance.now();

    try {
      await formatTerminal(
        diagnostics,
        SCORE,
        "Needs work",
        { composeFiles: [], dockerfiles: [file] },
        true,
        { [file]: content }
      );
    } finally {
      log.mockRestore();
    }

    const elapsed = performance.now() - startedAt;

    expect(printed.some((text) => text.includes("RUN echo step-20000"))).toBe(
      true
    );
    expect(elapsed).toBeLessThan(VERBOSE_BUDGET_MS);
  });
});
