---
"@docker-doctor/cli": patch
---

The post-scan wizard now reports a failed write (workflow scaffold, `.docker-doctor/`, `.gitignore`) and exits non-zero instead of silently pretending it succeeded; `.docker-doctor/diagnostics.json` flattens messages and paths the same way the per-rule `.txt` files already did; and every CLI error path sets the exit code instead of calling `process.exit`, so piped output is never cut short.
