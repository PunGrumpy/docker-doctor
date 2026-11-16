---
"@docker-doctor/cli": patch
---

`avoid-dev-dependencies` no longer goes silent when a `RUN` merely contains the text "prune" (for example `node scripts/prune-cache.js`); only a real `npm prune` or `pnpm prune` command suppresses it.
