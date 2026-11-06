---
"@docker-doctor/cli": minor
---

Add `--no-config` to scan a repository you did not write without running its `docker-doctor.config.*` file or reading its rule overrides. The bundled skill now tells agents to use the `docker-doctor` on PATH when there is one, so a pinned version runs, and to pass `--no-config` on repositories the user did not author.
