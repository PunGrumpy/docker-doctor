---
"@docker-doctor/cli": patch
---

Discovered Dockerfiles, Compose files and `.dockerignore` files are now returned in sorted order, so repeated scans of an unchanged project produce byte-identical JSON reports (apart from the timestamp) and stable PR-comment row ordering. Previously the concurrent workspace walk emitted files in I/O-completion order.
