---
"@docker-doctor/cli": minor
---

The score now averages only over the files Docker Doctor could check. A Dockerfile with no instructions, such as an empty or comment-only file, no longer counts. Neither does a Compose file with no services, no top-level `models` and no `version` key. Such files have no findings, so they used to raise the score. When no file could be checked, there is no score. `--json` reports `score` and `label` as `null`, `--score` prints nothing, and the terminal report says why instead of showing a score box. This also applies to a directory with no Dockerfile or Compose file, which used to report 100 in `--json` and `--score`. Exit codes are unchanged.

The JSON report `schemaVersion` is now 6. It adds `analyzedFiles`, the number of files the score averages over, and lists `failures` in discovery order on every run. The GitHub Action leaves its `score` and `label` outputs empty when there is no score, and its commit status is `error` when no file could be analyzed.

For library users, `calculateScore` now requires the number of analyzed files and returns a `null` score and label for 0. `toJsonReport` requires `failures` and `analyzedFiles`. The new exports `isAnalyzableDockerfile` and `isAnalyzableCompose` decide which files count.
