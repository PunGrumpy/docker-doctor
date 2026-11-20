---
"@docker-doctor/cli": patch
---

Compose services that use `provider:` are no longer asked for a restart policy or resource limits, because Compose does not run them as containers. Scores can rise for files that have provider services.
