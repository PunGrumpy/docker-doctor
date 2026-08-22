---
"@docker-doctor/cli": patch
---

Three rule-accuracy fixes: `no-root-user` now detects `USER root:root`, `USER root:0` and other `user:group` root spellings; `prefer-slim-base` recognizes minimal images by name (`alpine`, `busybox`, distroless) instead of only by tag, removing false positives on `alpine:3.19`; `use-dockerignore` now requires a `.dockerignore` next to the Dockerfile or at the scan root, instead of accepting any `.dockerignore` anywhere in the workspace.
