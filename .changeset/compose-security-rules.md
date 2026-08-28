---
"@docker-doctor/cli": minor
---

Add three Compose security rules aimed at agent-era compose files: `no-privileged-service` (error) flags `privileged: true`, `no-docker-socket-mount` (error) flags bind mounts of `/var/run/docker.sock` in short or long volume syntax, and `no-plaintext-secrets` (warning) flags literal credential values in `environment`. Because new rules add findings, existing projects can score lower than on 0.4.x.
