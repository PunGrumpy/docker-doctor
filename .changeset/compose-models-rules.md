---
"@docker-doctor/cli": minor
---

Understand the Compose `models:` element (Docker Model Runner) with two new rules: `undefined-model-reference` (error) flags service-level model references with no matching top-level declaration, and `pin-model-version` (warning) flags model artifacts with no tag or a `latest` tag. Unpinned weights change behavior with nothing visible in version control.
