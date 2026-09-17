---
"@docker-doctor/cli": minor
---

Raise the supported Node.js floor to 22.18. The CLI's dependencies already required Node 22, and `docker-doctor.config.ts` only loads on runtimes that strip TypeScript types natively (22.18+). On an older Node the CLI now explains the `.ts` config failure and points at the YAML/JSON alternatives instead of printing `Unknown file extension ".ts"`.
