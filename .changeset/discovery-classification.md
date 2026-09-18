---
"@docker-doctor/cli": patch
---

Fix three discovery false positives: `<name>.dockerignore` files (BuildKit's per-Dockerfile ignore convention) are no longer scanned as Dockerfiles, Dockerfiles with no instructions no longer produce `no-root-user` / `require-labels` findings, and discovered paths are always `/`-separated so the `.dockerignore` check and the JSON report behave the same on Windows.
