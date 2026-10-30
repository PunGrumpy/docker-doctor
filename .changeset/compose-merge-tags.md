---
"@docker-doctor/cli": patch
---

A Compose file that uses the merge tags `!reset` or `!override` no longer prints an `Unresolved tag` YAMLWarning on stderr for each tag on every scan. The tags are valid Compose, so the warning was noise, and the values under them are read as before. A Compose file with a YAML error is still reported with its line and column.
