---
"@docker-doctor/cli": patch
---

`no-plaintext-secrets` and `no-secrets-in-env` now report AI provider keys such as `OPENAI_KEY` and `LITELLM_MASTER_KEY`, token-shaped values under any key name, and literal secrets in Compose `build.args`. Reports mask token-shaped values. These new detections can lower the score of a project that scored clean before.
