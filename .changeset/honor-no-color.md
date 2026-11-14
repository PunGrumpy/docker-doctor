---
"@docker-doctor/cli": patch
---

The terminal report now turns colors off when `NO_COLOR` is set to any non-empty value, as the GitHub Action already expected. `NO_COLOR` wins over `FORCE_COLOR`.
