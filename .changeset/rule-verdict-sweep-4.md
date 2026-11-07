---
"@docker-doctor/cli": patch
---

`no-broad-bind-mount` no longer reports a read-only mount of `/etc/localtime`, `/etc/timezone` or `/etc/ssl/certs`, and it still reports the same paths mounted writable. `useradd-no-log-init` now follows hadolint DL3046 and reports only a `useradd` that runs with a UID of six or more digits and no `-l`, so a plain `useradd` and a quoted `echo "useradd"` scan clean. `use-pipefail` no longer counts the bar in a `case` pattern, in `$(( ))` or `${ }`, or in an escaped `\|` as a pipe.
