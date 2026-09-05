---
"@docker-doctor/cli": patch
---

`no-docker-socket-mount` compared the volume source against the literal `/var/run/docker.sock`, so it caught 1 of the 5 ways agent stacks mount the socket. The rule now resolves `${VAR:-default}` interpolation to the default and matches the socket by name on any path-shaped source, which covers:

- `${DOCKER_SOCK:-/var/run/docker.sock}`, the mcp-gateway pattern
- `/run/docker.sock` on systemd hosts
- rootless and Docker Desktop sockets under a home directory
- `//var/run/docker.sock` from Git Bash on Windows
- the `\\.\pipe\docker_engine` named pipe

A `${VAR}` source with no default names no host path, so the rule flags it only when the target is `/var/run/docker.sock`.

`pin-model-version` now checks the service-level `provider: { type: model }` syntax (Compose 2.35 to 2.37, still used in the compose-for-agents examples) as well as the top-level `models:` element.
