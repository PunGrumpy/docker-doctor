---
"@docker-doctor/cli": patch
---

Detect `useradd` with a large UID in exec-form `RUN` shells that pass options before `-c`, such as `["bash", "-o", "pipefail", "-c", "..."]`.
