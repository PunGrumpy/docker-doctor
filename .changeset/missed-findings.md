---
"@docker-doctor/cli": patch
---

`avoid-dev-dependencies`, `avoid-run-cd` and `use-multi-stage` now look past BuildKit flags on `RUN`. They used to take `--mount=type=cache,…` for the command and report nothing, so `RUN --mount=type=cache,target=/root/.npm npm ci` went unreported. `no-privileged-service` reports the other spellings Compose reads as true (`privileged: "true"`, `yes`, `on`), and a bind mount with `read_only: "true"` counts as read-only. The Dockerfile parser accepts any word as a heredoc delimiter, as BuildKit does. `RUN <<END-OF-SCRIPT` and `COPY <<nginx.conf …` used to fail the scan with a false "unterminated heredoc" error.
