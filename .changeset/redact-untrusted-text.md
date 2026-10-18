---
"@docker-doctor/cli": patch
---

Rule messages no longer repeat credentials from the scanned files. The user name and password in a URL such as `https://user:token@host` are shown as `***`. A URL with a user name only, such as `ssh://git@host/repo.git`, is masked the same way. The value of a secret-like `KEY=value` or `--flag value` is shown as `***` too. This applies in the terminal, `--json`, `.docker-doctor/` and the agent handoff. A Compose file that fails to parse is reported with its line and column only. The YAML source lines are left out. The agent handoff also replaces invisible Unicode with a space. That covers C1 controls, zero-width and bidi control characters, the BOM, line and paragraph separators, and tag characters.
