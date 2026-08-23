---
"@docker-doctor/cli": patch
---

Sanitize scanned file paths before they reach a coding agent. Rule messages were already flattened, but the paths beside them were interpolated raw into both the handoff prompt and the `.docker-doctor/*.txt` reports, so a filename containing newlines could introduce its own line into an agent's instructions. Those per-rule reports now also flatten the message, matching the prompt.
