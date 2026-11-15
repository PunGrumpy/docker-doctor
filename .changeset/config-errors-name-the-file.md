---
"@docker-doctor/cli": patch
---

A config error now names the config file it came from and the real type it found, so a `null` or list `rules` section reads "got null" or "got array" instead of "got object". An invalid severity lists the accepted values: error, warning, info, off.
