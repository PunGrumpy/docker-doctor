---
"@docker-doctor/cli": patch
---

`require-resource-limits` only looked at `deploy.resources.limits`, so it warned services that set limits through the service-level `mem_limit`, `cpus`, or `cpu_quota` keys. Those keys are the older spelling of the same limits, still in the Compose specification and applied the same way by `docker compose`, and now satisfy the rule.

`no-plaintext-secrets` and `no-secrets-in-env` now share one definition of a literal secret value. A URL without embedded credentials (`AUTH_URL: http://auth:8080`, `TOKEN_ENDPOINT: https://id.example.com/oauth/token`) names an endpoint, so the rules skip it; a URL carrying `user:password@` still counts. The key patterns also gain the spellings agent stacks use: `PGPASSWORD`-style names with no separator before `PASSWORD`, `APIKEY`, and `PAT` as in `GITHUB_PAT`. `PATH` and `PATTERN` stay clean.
