---
"@docker-doctor/cli": minor
---

Add the `pin-service-image` Compose rule (warning): flags service `image:` references with no tag or with the mutable `latest` tag, mirroring `pin-image-version` for Dockerfiles. Services with a `build:` context and `${VAR}`-templated references are skipped.
