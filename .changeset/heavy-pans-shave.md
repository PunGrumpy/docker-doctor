---
"@docker-doctor/cli": minor
---

Add seven rules covering build-time credentials, cache mounts, and Compose security.

Dockerfile: `use-cache-mount` flags package manager installs that could keep their downloads in a BuildKit cache mount, and `use-secret-mount` flags a `RUN` that consumes a credential-shaped build argument, which is readable from image history.

Compose: `no-privileged`, `no-host-network`, `no-docker-socket-mount`, `no-secrets-in-compose-env`, and `pin-service-image` close the gap where Compose files were only checked for reliability, never for the ways they hand a service the host.
