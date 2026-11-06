---
"@docker-doctor/cli": minor
---

Add the `no-unsafe-build-features` rule. It reports a `# syntax=` directive that selects a BuildKit frontend other than the official `docker/dockerfile` (a third-party frontend pinned by digest passes), and `RUN --security=insecure` or `RUN --network=host`.
