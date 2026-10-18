---
"@docker-doctor/cli": patch
---

The bundled `docker-doctor` skill no longer treats a steady score as proof that a change is safe. Since 0.7.0 the score averages over the analyzed files, so a new error in one file of a large project can move it by a single point. The skill now compares the exit code and the number of findings per rule before and after a change, and uses the score as a coarse signal. It also says that `rules explain` prints the rule's category, default severity and description next to the same fix text as `Help:`.
