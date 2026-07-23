---
"@docker-doctor/cli": patch
---

Fix four rule-specificity bugs in the Dockerfile rule engine:

- `no-root-user` now resets its tracked user at each `FROM` (build stage), instead of letting a `USER` set in an earlier stage (e.g. a builder) silently satisfy the check for a later stage that never sets one. Multi-stage Dockerfiles may now surface a new diagnostic here.
- `no-add-remote`, `prefer-copy-over-add`, and `use-dockerignore` now read the first non-flag operand of `ADD`/`COPY` instead of always taking the first whitespace-separated token, so a leading flag like `--chown` or `--from` no longer silently disables the check (e.g. `ADD --chown=node:node https://...` now correctly trips `no-add-remote`). As a side effect, `use-dockerignore` now explicitly skips `COPY --from=<stage>` since that never reads the build context. These fixes may surface new diagnostics.
- `no-secrets-in-env` no longer matches secret keywords as an unanchored substring, so keys like `AUTHOR` or `OAUTH_ISSUER_URL` no longer false-positive as "potential secret found" (this is the only error-severity rule, so this previously failed CI on Dockerfiles with no secrets). Genuine segment matches like `DB_PASSWORD` still match. This removes diagnostics.
- `order-layers` now resets its copy-tracking at each build stage, so a copy-everything in an earlier stage no longer implicates an install command in a later, correctly-ordered stage, and no longer substring-matches `"src"` anywhere in a path (e.g. `/usr/src/lib`, `mysrcdir`). This removes diagnostics.

These are bug fixes to rule specificity; expect docker-doctor scores to move on existing Dockerfiles as false negatives are corrected and false positives are removed.
