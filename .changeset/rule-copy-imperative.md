---
"@docker-doctor/cli": patch
---

Reword all 25 rule summaries into one imperative voice ("Run the container as a non-root user", "Use multi-stage builds", "Add a .dockerignore file") and format code tokens in help text as backticks (`USER node`, `apk add --no-cache`). `rules list`, `rules explain`, and the docs show the new wording; rule keys, severities, and diagnostic messages are unchanged.
