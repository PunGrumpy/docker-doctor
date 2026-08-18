---
"@docker-doctor/cli": patch
---

Resolve YAML merge keys (`<<: *anchor`) when parsing Compose files, eliminating false `require-restart-policy` / `require-resource-limits` warnings on services that inherit those settings from an extension field.
