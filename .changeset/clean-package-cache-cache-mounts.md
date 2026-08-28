---
"@docker-doctor/cli": patch
---

`clean-package-cache` no longer flags `RUN` instructions that keep apt/apk caches in BuildKit cache mounts (`--mount=type=cache,target=/var/cache/apt`, the pattern Docker documents). A cache mount elsewhere, or a bind mount, still warns.
