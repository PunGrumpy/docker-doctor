---
"@docker-doctor/cli": patch
---

Compose diagnostics now include the line number of the offending service or key, so terminal output and the GitHub Action's file links point to the correct line instead of the top of the file. Keys that only exist through YAML merge keys (`<<: *anchor`) fall back to the service line.
