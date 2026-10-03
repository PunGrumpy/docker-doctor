---
"@docker-doctor/cli": patch
---

`no-secrets-in-env` and `no-plaintext-secrets` no longer report a key that names the file a secret is stored in, such as `POSTGRES_PASSWORD_FILE=/run/secrets/pg` or `TLS_PRIVATE_KEY_PATH`. That is the Docker secrets setup both rules recommend. They also skip on/off values under a secret-shaped key, such as `AUTH_ENABLED=true` and `MYSQL_ALLOW_EMPTY_PASSWORD=yes`. Both rules still report a literal value under a credential-shaped key.
