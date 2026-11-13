---
"@docker-doctor/cli": minor
---

Add `--fail-on <error|warning|info|none>` to choose which findings make a scan exit `1`. The default, `error`, keeps the current behavior. `none` reports findings without failing, and an incomplete scan still exits `2`.
