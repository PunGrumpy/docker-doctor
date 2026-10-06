---
"@docker-doctor/cli": minor
---

The health score now averages the penalty over the files it analyzed. Before, it added up every finding in the scan, so a repository with many Dockerfiles or Compose files scored near 0 even when each file had only a couple of warnings. A project with one Docker file scores the same as before. A project with several files scores higher, and its score now moves when a typical file gets better or worse.

Exit codes are unchanged. An `error`-severity finding still fails the scan whatever the score is. The JSON report `schemaVersion` is now 5. `calculateScore` takes the number of analyzed files as an optional second argument.
