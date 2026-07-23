---
"@docker-doctor/cli": patch
---

Piped or redirected `--json`/`--score` output is no longer silently truncated. The scan action's output paths used `process.exit()` right after `console.log()`, which could abort the process before the async write to a pipe/file finished flushing. They now set `process.exitCode` and return, letting Node exit naturally once stdout has fully drained. Exit codes (`--score` below 50 exits 1; `--json`/default exit 1 on any error-severity diagnostic) are unchanged.

The score threshold table (labels/emoji at 90/75/50/0) is now exported as `SCORE_BUCKETS` (and `getScoreBucket`) from `@docker-doctor/core`, replacing what used to be duplicated inline logic in `calculateScore`. The printed/JSON `label` strings are byte-identical to before.
