---
"@docker-doctor/cli": patch
---

`--config` pointing at a directory now fails with a one-line error that names the path and asks for the config file itself, instead of a raw Node.js module import error. The exit code is still 1.
