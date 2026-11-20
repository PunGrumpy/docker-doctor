---
"@docker-doctor/cli": patch
---

`use-exec-form` no longer reports a shell-form `CMD` or `ENTRYPOINT` that starts with `exec`, such as `ENTRYPOINT exec top -b`, because `exec` hands signals to the command. It still reports one that pipes or runs in the background, such as `CMD exec node x | tee log`.
