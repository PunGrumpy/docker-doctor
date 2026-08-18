---
"@docker-doctor/cli": patch
---

Sanitize scanned-file content before it enters agent handoff prompts, label it as untrusted data, and ask for explicit confirmation before launching an agent with its skip-approvals flag.
