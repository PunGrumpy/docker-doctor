---
"@docker-doctor/cli": patch
---

Warn when a config names a rule or category that does not exist. Keys are matched exactly, so a typo'd rule key — or a category written as `security` instead of `Security` — used to be accepted and then silently match nothing, leaving a suppression the user believed was active doing nothing. Unknown keys are reported on stderr rather than failing the scan, so a config naming a rule removed in a later release still runs.
