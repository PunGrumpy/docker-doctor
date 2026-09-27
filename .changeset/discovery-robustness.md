---
"@docker-doctor/cli": patch
---

A subdirectory that cannot be read, such as a root-owned `data/` volume directory, no longer fails the whole scan. docker-doctor skips it and prints a warning on stderr. Discovery also skips well-known dependency, VCS and cache directories (`.venv`, `__pycache__`, `.yarn`, `coverage`, `.cache` and others), and it no longer walks a directory excluded by an `ignore.files` pattern ending in `/**`.
