---
"@docker-doctor/cli": patch
---

The interactive scan no longer sleeps for 350 ms before it reports, and the "Scanned" line shows the time the scan took. It also stops printing a worker count, which was never real, and says "1 file" for a single file.
