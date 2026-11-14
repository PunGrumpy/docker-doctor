---
"@docker-doctor/cli": minor
---

Every finding in the `--json` report now has a `fingerprint`, a short key that stays the same from scan to scan while the code the finding points at is unchanged, even when lines above it move or a new release rewords the message. The report `schemaVersion` is now 8. Scores do not change.
