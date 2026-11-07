---
"docker-doctor-kit": minor
---

The kit now publishes as a Kit Specification v3 image, so it composes with the built-in agents of Docker Sandboxes 0.51 and later. It ships the pinned CLI with its own Node runtime, so the base image no longer needs Node and sandbox creation no longer reaches npm. On sbx older than 0.51, use `docker.io/pungrumpy/docker-doctor-kit:0.1.14`.
