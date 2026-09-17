---
"@docker-doctor/cli": patch
---

Every diagnostic in the `--json` report (and in `.docker-doctor/diagnostics.json`) now carries its rule's `category`, so consumers no longer need a second `rules list` call to group findings. The report `schemaVersion` is now `3`; all existing fields are unchanged.
