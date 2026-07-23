---
"@docker-doctor/cli": patch
---

`effect` is no longer a runtime dependency of `@docker-doctor/cli`. The single `Schema.Struct` used to validate `docker-doctor.config.*` and the three `Data.TaggedError` error classes (`ConfigError`, `ParseError`, `FileNotFoundError`) have been replaced with a hand-rolled validator and plain `Error` subclasses that preserve the exact same validation rules, error `_tag` discriminants, and public API. The package's public types no longer reference `effect/Schema`, so consumers no longer pull in a pinned pre-release beta package for a tiny surface area.
