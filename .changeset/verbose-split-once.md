---
"@docker-doctor/cli": patch
---

`--verbose` no longer slows down on large files. A 20,000-line Dockerfile with 40,000 findings went from 27 seconds to under 2.
