---
"@docker-doctor/cli": patch
---

The bundled `docker-doctor` skill no longer claims that category severities other than `"off"` are ignored — `categories` entries cascade to every rule in the category unless a per-rule entry overrides them.
