---
"@docker-doctor/cli": patch
---

`--verbose` code frames and messages now mask the value of a `Cookie` or `Set-Cookie` header quoted from a scanned file. With `--baseline`, a finding on a line that holds such a header gets a new fingerprint, so it shows once as new and once as resolved against a baseline saved by an earlier version.
