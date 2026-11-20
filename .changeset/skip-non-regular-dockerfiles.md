---
"@docker-doctor/cli": patch
---

A Dockerfile or Compose file that is a device, a FIFO or a link to one now fails the scan with exit code 2 instead of hanging or running out of memory.
