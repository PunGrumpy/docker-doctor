---
"@docker-doctor/cli": minor
---

A Compose override file is now judged with the base file beside it, the way `docker compose` runs them, and `!reset` and `!override` are read as Compose reads them. The rules for resource limits, restart policies and model references no longer flag what the base already sets, a one-shot job that another service waits on is no longer asked for a restart policy, and scores for projects with an override file can rise.
