# Scan and report

A scan finds every Dockerfile and Compose file under a directory, checks them against the rules, and prints a report with a 0 to 100 health score. The exit code says whether a finding at or above the fail threshold was found.

## Sub-features

- `scan-terminal` prints the category summary and the score for humans.
- `scan-score` prints only the number.
- `scan-json` prints the full report as JSON.
- `scan-verbose` lists every finding with its rule, line and help text.
- `scan-exit` exits 0 when nothing reaches the threshold, 1 when an error-severity finding does, and 2 when any file could not be analyzed, even if others were.
- `scan-default` scans the current directory when no path is given.

## How to get to it (user POV)

- Run `docker-doctor` in a project directory.
- Run `docker-doctor <dir>` to scan another directory.
- Add `--score`, `--json` or `--verbose` to change the output.

## Driving it with control-docker-doctor

Preconditions:

- `$C fixture --run "$RUN" clean with-error all-broken` ran.

- **Terminal report.** Scan the clean fixture. Run `$C run --run "$RUN" -- clean`. Exit code `0`, and stdout has `Best Practices › 1 issue` and `99 / 100 Excellent`.
- **Score only.** Run `$C run --run "$RUN" -- --score clean`. Exit code `0` and stdout is exactly `99`.
- **JSON report.** Run `$C run --run "$RUN" -- --json with-error`. Exit code `1`. stdout parses as JSON with `analyzedFiles` equal to `1`, and `diagnostics` holds a `docker-doctor/no-secrets-in-env` entry with severity `error` on line `2`.
- **Verbose findings.** Run `$C run --run "$RUN" -- --verbose with-error`. Exit code `1`, and stdout names `docker-doctor/no-secrets-in-env` with its help text.
- **Default directory.** Scan with no path, so docker-doctor scans `work/` and every fixture copied there. Run `$C run --run "$RUN" -- --score`. Exit code `2`, because `all-broken` fails analysis. stderr says `could not analyze 2 files; the score below covers only the files that were analyzed`, and stdout is `91`, the score of `clean` and `with-error`.
- **Nothing analyzable.** Run `$C run --run "$RUN" -- --score all-broken`. Exit code `2`. stderr says `Docker Doctor could not analyze 2 files` and `there is no score`, and stdout is empty.

## Gotchas

- The score is an average per analyzed file. A file docker-doctor could not parse does not count, so a broken file next to a good one does not lower the score.
- Exit 2 takes priority over exit 1. A scan with one broken file exits 2 even when another file has an error-severity finding.
- `--score` still exits 1 on an error-severity finding. Assert the exit code and the number separately.
- The terminal report includes a share URL built from the findings. It is not a network call.
- A path that does not exist and looks like a command name gets the `Unknown command` error, not a scan.
