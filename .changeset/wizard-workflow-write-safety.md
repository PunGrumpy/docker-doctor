---
"@docker-doctor/cli": patch
---

The interactive wizard now scaffolds `.github/workflows/docker-doctor.yml` into the scanned directory instead of the current working directory, and asks before overwriting an existing workflow file (declining, or a non-interactive run, keeps the existing file).
