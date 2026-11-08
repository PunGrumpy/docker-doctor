---
"@docker-doctor/cli": minor
---

Silence one finding with an inline comment: `# docker-doctor-ignore <rule> -- <reason>` above a Dockerfile instruction or on a Compose line, or `# docker-doctor-ignore-file <rule>` at the top of a file. Suppressed findings move to a new `suppressed` list in the JSON report (schema 7, which also drops the unused `column` field) and count toward neither the score nor the exit code. `--no-config` also ignores these comments.
