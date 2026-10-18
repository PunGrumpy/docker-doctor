---
"@docker-doctor/cli": minor
---

`parseCompose` now returns a `ComposeValue`, and `runComposeRules` and `isAnalyzableCompose` take one. Both `ComposeValue` and `ComposeMapping` are exported. A TypeScript caller that passed these functions an `unknown` value passes the result of `parseCompose` instead. Nothing changes at run time.
