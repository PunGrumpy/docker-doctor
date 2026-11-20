---
"@docker-doctor/cli": patch
---

`use-pipefail` no longer reports a pipe in a `RUN` when the stage's `SHELL` is `cmd`, `powershell` or `pwsh`, because those shells have no `pipefail` option.
