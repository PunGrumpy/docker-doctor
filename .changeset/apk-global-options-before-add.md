---
"@docker-doctor/cli": patch
---

Check `RUN apk --update add ...` and other `apk` commands with an option before `add` for a missing `--no-cache`, and accept a global `apk --no-cache add`.
