---
"@docker-doctor/cli": patch
---

Fix `FROM` and `COPY`/`ADD` instruction parsing in rules to correctly skip option flags (e.g. `--platform`, `--chown`), preventing false-positive diagnostics or layer ordering check failures.
