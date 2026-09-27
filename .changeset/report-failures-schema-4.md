---
"@docker-doctor/cli": minor
---

The JSON report (`--json`, schema 4) now includes `failures[]`, one entry with the error message for every discovered file that could not be read or parsed. The GitHub Action marks those files as Unanalyzed, says so in the summary, and fails the pull request check regardless of `blocking`. Before, an unparseable Dockerfile rendered as Clean with a score of 100.
