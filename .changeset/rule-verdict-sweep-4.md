---
"@docker-doctor/cli": patch
---

`no-broad-bind-mount` no longer reports a read-only mount of `/etc/localtime`, `/etc/timezone` or `/etc/ssl/certs`, and it still reports the same paths mounted writable.
