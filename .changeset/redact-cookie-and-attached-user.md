---
"@docker-doctor/cli": patch
---

`--verbose` code frames and messages now mask the value of a `Cookie` or `Set-Cookie` header and a password attached to curl's `-u` option (`-uuser:password`) when they are quoted from a scanned file. With `--baseline`, a finding on a line that holds such a header or option gets a new fingerprint, so it shows once as new and once as resolved against a baseline saved by an earlier version.
