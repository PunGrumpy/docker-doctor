---
"@docker-doctor/cli": patch
---

A scan flag placed after a subcommand, such as `docker-doctor rules list --json`, now fails with "unknown option" instead of being accepted and ignored. `rules list` has no JSON output. Scan flags still work on either side of the directory. Flags such as `--json` or `--version` go before the subcommand, so `docker-doctor install --version` now fails too. A command-line error now ends with a hint to add `--help`.
