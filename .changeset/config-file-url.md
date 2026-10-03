---
"@docker-doctor/cli": patch
---

A `docker-doctor.config.ts`, `.js`, `.mjs` or `.cjs` now loads on Windows, and from a project whose path contains `#`, `?` or `%`. The CLI imported the config by its bare path. Node rejects a drive-letter path with `ERR_UNSUPPORTED_ESM_URL_SCHEME` and misreads a path that contains URL characters. JSON and YAML configs always loaded.
