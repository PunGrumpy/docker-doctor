---
"@docker-doctor/cli": patch
---

Fix workspace discovery to correctly track and validate `.dockerignore` files, resolving false-positive warnings in the `useDockerignore` performance rule.
