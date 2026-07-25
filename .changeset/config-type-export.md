---
"@docker-doctor/cli": patch
---

Export the `DockerDoctorConfig` type (plus `RuleCategory`) and a `defineConfig` helper for typed `docker-doctor.config.ts` files, and fix the config type's `categories` field to accept a subset of categories (`Partial<Record<…>>`) — matching the validator's actual behavior and the documented examples.
