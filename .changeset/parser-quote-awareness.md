---
"@docker-doctor/cli": patch
---

Fix four false results from reading shell text without quote awareness: a `<<EOF` inside a quoted string no longer opens a heredoc, a heredoc that never closes now fails the file (exit 2, "scan incomplete") instead of silently dropping every instruction after it, `avoid-run-cd` only flags `cd` in command position (`/opt/cd` and `cd.tar.gz` no longer match), `use-pipefail` ignores `|` inside quoted arguments, and a `services:` written as a YAML list is treated as invalid Compose rather than as services named `0`, `1`, …
