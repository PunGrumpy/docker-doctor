---
"@docker-doctor/cli": minor
---

New Compose rules `no-host-namespaces` and `no-weakened-confinement` report namespaces set to `host`, capabilities such as `SYS_ADMIN`, and `unconfined` security options. `no-privileged-service` now reports `cap_add: [ALL]` as an error, and `no-broad-bind-mount` reports `/dev`, `/var` and `/var/lib/docker`.
