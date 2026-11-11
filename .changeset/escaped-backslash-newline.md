---
"@docker-doctor/cli": patch
---

An escaped backslash (`\\`) at the end of a line no longer joins the next line into the same shell command, so rules see `rm -rf x` on its own line.
