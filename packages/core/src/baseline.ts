import type { FingerprintedDiagnostic } from "./types/index";

// How the findings of a scan compare with a saved report, by fingerprint.
export interface BaselineCounts {
  existing: number;
  new: number;
  // In the saved report, but no longer found.
  resolved: number;
}

export const isNewFinding = (
  finding: FingerprintedDiagnostic,
  baseline: ReadonlySet<string>
): boolean => !baseline.has(finding.fingerprint);

export const compareWithBaseline = (
  diagnostics: readonly FingerprintedDiagnostic[],
  baseline: ReadonlySet<string>
): BaselineCounts => {
  const current = new Set(diagnostics.map((d) => d.fingerprint));
  const fresh = diagnostics.filter((d) => isNewFinding(d, baseline)).length;
  let resolved = 0;

  for (const fingerprint of baseline) {
    if (!current.has(fingerprint)) {
      resolved += 1;
    }
  }

  return { existing: diagnostics.length - fresh, new: fresh, resolved };
};
