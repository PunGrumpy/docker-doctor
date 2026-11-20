---
"@docker-doctor/cli": patch
---

Compose services that use `provider:` are no longer asked for a restart policy or resource limits, because Compose does not run them as containers. A short `depends_on` list that names only provider services is no longer flagged either, because Compose does not wait on them. Scores can rise for files that have provider services.
