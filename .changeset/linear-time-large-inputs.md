---
"@docker-doctor/cli": patch
---

Scans are faster on large or unusual inputs. A Dockerfile with thousands of stages no longer takes seconds to check, an `ignore.files` pattern with adjacent repeats of `**/` no longer stalls the scan, and discovery does less work on large trees.
