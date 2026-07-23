---
"@docker-doctor/cli": patch
---

The Dockerfile parser now understands heredoc (`<<EOF`) syntax — bodies are folded into the owning instruction instead of being mis-parsed as separate instructions — so content-based rules now inspect heredoc commands and phantom instructions no longer appear.
