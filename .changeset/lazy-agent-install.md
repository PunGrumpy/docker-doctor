---
"@docker-doctor/cli": patch
---

Every run starts about 20 ms faster. The CLI now loads its agent installer only for `install` and the post-scan agent handoff.
