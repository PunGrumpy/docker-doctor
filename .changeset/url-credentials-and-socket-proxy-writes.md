---
"@docker-doctor/cli": minor
---

`no-secrets-in-env` and `no-plaintext-secrets` now report a literal password inside a URL value, such as `DATABASE_URL: postgres://app:pw@db`, and keys such as `ACCESS_TOKEN_EXPIRE_MINUTES` and `TOKEN_LIMIT` are no longer reported as secrets. `no-docker-socket-mount` now reports a socket proxy that allows `POST` on containers, turns on `AUTH` or `SECRETS`, passes `-allowPOST`, or publishes its port on all interfaces. These new findings lower scores, and a Dockerfile `ENV` that holds a URL password now exits 1.
