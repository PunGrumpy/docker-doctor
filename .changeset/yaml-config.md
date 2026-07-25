---
"@docker-doctor/cli": patch
---

Support `docker-doctor.config.yaml` / `.yml` config files (resolved after `.json`, and via `--config`). A JSON Schema generated from the rule set is published at https://docker-doctor.vercel.app/schema.json for editor autocomplete/validation in YAML (`# yaml-language-server: $schema=…`) and JSON (`"$schema"` key) configs.
