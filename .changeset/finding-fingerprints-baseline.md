---
"@docker-doctor/cli": minor
---

Add `--baseline <report.json>` to fail a scan only on findings that a report saved earlier with `--json` does not have, so a project with findings today can turn on `--fail-on warning` and still catch every new one. Every finding in the `--json` report now has a `fingerprint`, a short key that stays the same from scan to scan while the code the finding points at is unchanged, even when lines above it move or a new release rewords the message. The report `schemaVersion` is now 8. Scores do not change.

For library users, `toJsonReport` now takes one object with named fields (`analyzedFiles`, `baseline`, `diagnostics`, `failures`, `label`, `project`, `score` and `suppressed`) instead of seven positional arguments. Its `diagnostics` and `suppressed` need a `fingerprint` on each finding, which the new `fingerprintDiagnostics(diagnostics, fileContents)` export adds. Pass `baseline: null` unless you compare with a saved report.
