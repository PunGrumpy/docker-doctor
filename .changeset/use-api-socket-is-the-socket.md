---
"@docker-doctor/cli": minor
---

`no-docker-socket-mount` now reports services that set `use_api_socket: true`, because Compose mounts the Docker socket and copies your registry credentials into the container. Those services now get an error, so a CI gate fails until you decide, and the rule no longer recommends `use_api_socket`. Socket proxy images such as `tecnativa/docker-socket-proxy` may still mount the socket.
