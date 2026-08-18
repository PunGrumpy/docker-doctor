---
"@docker-doctor/cli": patch
---

Fix the Dockerfile parser treating shell `<<` (arithmetic, here-strings) as a heredoc opener, which silently swallowed the rest of the file and produced false diagnostics.
