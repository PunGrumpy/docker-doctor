---
"@docker-doctor/cli": minor
---

`no-secrets-in-env` and `no-plaintext-secrets` now report a literal password inside a URL value, such as `DATABASE_URL: postgres://app:pw@db`, and keys such as `ACCESS_TOKEN_EXPIRE_MINUTES` and `TOKEN_LIMIT` are no longer reported as secrets. `no-docker-socket-mount` now reports a socket proxy that can write, such as one with `POST` on together with `CONTAINERS`, `EXEC`, `BUILD`, `SERVICES`, `PLUGINS`, `SWARM`, `AUTH` or `SECRETS`, or a wollomatic proxy that passes `-allowPOST`, `-allowPUT` or `-allowDELETE`, or one that publishes its port on every interface. It covers the common write paths, not every one. These new findings lower scores, and a Dockerfile `ENV` that holds a URL password now exits 1.
