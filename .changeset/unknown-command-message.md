---
"@docker-doctor/cli": patch
---

A mistyped command such as `docker-doctor instal`, `init`, `help` or `list` now prints "Unknown command" with a suggestion and a pointer to `--help`, instead of "Directory not found". A real directory with that name is still scanned, and the exit code is still 1.
