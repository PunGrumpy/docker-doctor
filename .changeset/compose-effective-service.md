---
"@docker-doctor/cli": minor
---

A Compose override file is now judged with the base file beside it, the way `docker compose` runs them, and `!reset` and `!override` are read as Compose reads them. The rules for resource limits, restart policies and model references no longer flag what the base already sets, and each finding lands in the file where you would fix it. A one-shot job that another service waits on is no longer asked for a restart policy. Scores for most projects with an override file rise. A project whose override resets a setting the base sets can score lower, because Compose runs the service without it.
