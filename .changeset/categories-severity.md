---
"@docker-doctor/cli": patch
---

`categories` severity values other than "off" now actually override rule severities (previously they were silently ignored), and category handling moved into the core runners so programmatic API consumers get the same results as the CLI.
