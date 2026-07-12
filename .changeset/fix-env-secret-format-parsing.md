---
"@docker-doctor/cli": patch
---

Fix `no-secrets-in-env` rule to support space-separated `ENV KEY VALUE` format, ensuring hardcoded credentials in this format are correctly detected by the linter.
