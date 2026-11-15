# Fail threshold and baseline

`--fail-on` picks the lowest severity that fails a scan. `--baseline` takes a saved JSON report, so only findings that report does not have can fail the scan. Together they let a team adopt docker-doctor on an existing project without fixing every old finding first.

## Sub-features

- `fail-on-warning` fails on a warning that the default threshold lets through.
- `fail-on-none` never fails on findings.
- `baseline-quiet` passes when every finding is already in the baseline.
- `baseline-new` fails on a finding the baseline does not have and counts it as new.

## How to get to it (user POV)

- Run `docker-doctor --fail-on <error|warning|info|none> <dir>`.
- Save a report with `docker-doctor --json <dir> > report.json`, then run `docker-doctor --baseline report.json <dir>`.

## Driving it with control-docker-doctor

Preconditions:

- `$C fixture --run "$RUN" low-score-no-errors with-error` ran, so `with-error` is unedited.

- **Default threshold.** Run `$C run --run "$RUN" -- --score low-score-no-errors`. Exit code `0` and stdout is `8`, because every finding is a warning or info.
- **Warning threshold.** Run `$C run --run "$RUN" -- --fail-on warning --score low-score-no-errors`. Exit code `1` and stdout is still `8`.
- **No threshold.** Run `$C run --run "$RUN" -- --fail-on none --score with-error`. Exit code `0`, although the fixture has an error.
- **Save a baseline.** Run `$C run --run "$RUN" -- --json with-error`, then copy the JSON from that evidence file's stdout section into `work/base.json`. Exit code `1` for the scan.
- **Baseline with nothing new.** Run `$C run --run "$RUN" -- --baseline base.json with-error`. Exit code `0`.
- **New finding.** Append `RUN apt-get install curl` to `work/with-error/Dockerfile`, then run `$C run --run "$RUN" -- --baseline base.json --fail-on warning with-error`. Exit code `1`, and stdout has `Baseline: 2 new, 3 existing, 0 resolved`. Without `--fail-on warning` the same scan exits `0`, because both new findings are below error severity.
- **Reset.** Run `$C fixture --run "$RUN" with-error`.

## Gotchas

- The baseline matches findings by fingerprint, not by line number. Moving a line does not make its finding new.
- The baseline does not lower the default threshold. A new warning still passes unless `--fail-on warning` is set.
- Write the baseline file inside `work/`. The helper refuses a `--baseline` path outside it.
- The evidence file wraps stdout in its own headers. Copy only the JSON body into `base.json`.
