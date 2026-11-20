---
"@docker-doctor/cli": patch
---

The clean-package-cache rule no longer slows down on a RUN line that repeats `apk add` many times. A 400 KB line took about 8 seconds and now takes milliseconds, with the same findings.
