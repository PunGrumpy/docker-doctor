---
"@docker-doctor/cli": patch
---

Exit with status 2 when a Dockerfile or Compose file cannot be read or parsed, and list the affected files on stderr. Previously an unparseable file contributed no diagnostics and the run could report a perfect score with exit 0 — a green CI gate over a file that was never analyzed.
