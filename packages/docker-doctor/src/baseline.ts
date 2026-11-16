import fs from "node:fs/promises";

// The first report schema whose findings carry a fingerprint.
const FINGERPRINT_SCHEMA_VERSION = 8;

interface SavedReport {
  diagnostics: unknown[];
  suppressed?: unknown;
}

interface FingerprintedFinding {
  fingerprint: string;
}

interface FingerprintedReport extends SavedReport {
  diagnostics: FingerprintedFinding[];
  schemaVersion: number;
}

const isSavedReport = (value: unknown): value is SavedReport =>
  typeof value === "object" &&
  value !== null &&
  "diagnostics" in value &&
  Array.isArray(value.diagnostics);

const isFingerprintedFinding = (
  value: unknown
): value is FingerprintedFinding =>
  typeof value === "object" &&
  value !== null &&
  "fingerprint" in value &&
  typeof value.fingerprint === "string";

const hasFingerprintSchema = (
  report: SavedReport
): report is SavedReport & { schemaVersion: number } =>
  "schemaVersion" in report &&
  typeof report.schemaVersion === "number" &&
  report.schemaVersion >= FINGERPRINT_SCHEMA_VERSION;

const isFingerprintedReport = (
  report: SavedReport
): report is FingerprintedReport =>
  hasFingerprintSchema(report) &&
  report.diagnostics.every(isFingerprintedFinding);

const shellQuote = (text: string): string =>
  `'${text.replaceAll("'", "'\\''")}'`;

const regenerateHint = (file: string): string =>
  `Write it again with this version of docker-doctor: docker-doctor <dir> --json --fail-on none > ${shellQuote(file)}`;

const parseBaseline = (file: string, text: string): FingerprintedReport => {
  const notAReport = `${file} is not a docker-doctor JSON report. ${regenerateHint(file)}`;
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error: unknown) {
    throw new Error(notAReport, { cause: error });
  }

  if (!isSavedReport(parsed)) {
    throw new Error(notAReport);
  }

  if (!isFingerprintedReport(parsed)) {
    throw new Error(
      `${file} was written by an older docker-doctor and its findings have no fingerprints, so new findings cannot be told from old ones. ${regenerateHint(file)}`
    );
  }

  return parsed;
};

export interface SavedBaseline {
  // The paths the saved report's findings, suppressed ones included, point at.
  files: ReadonlySet<string>;
  fingerprints: ReadonlySet<string>;
}

const hasFile = (value: unknown): value is { file: string } =>
  typeof value === "object" &&
  value !== null &&
  "file" in value &&
  typeof value.file === "string";

const reportedFiles = (report: SavedReport): Set<string> => {
  const suppressed: unknown[] = Array.isArray(report.suppressed)
    ? report.suppressed
    : [];

  const files = new Set<string>();

  for (const finding of [...report.diagnostics, ...suppressed]) {
    if (hasFile(finding)) {
      files.add(finding.file);
    }
  }

  return files;
};

/**
 * Reads a saved --json report and returns the fingerprints and file paths of
 * its findings. Throws an Error whose message tells the user how to fix the
 * file, so the scan stops with exit 1 before it starts.
 */
export const readBaseline = async (file: string): Promise<SavedBaseline> => {
  let text: string;

  try {
    text = await fs.readFile(file, "utf-8");
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`Cannot read the --baseline report. ${reason}`, {
      cause: error,
    });
  }

  const report = parseBaseline(file, text);

  return {
    files: reportedFiles(report),
    fingerprints: new Set(report.diagnostics.map((d) => d.fingerprint)),
  };
};
