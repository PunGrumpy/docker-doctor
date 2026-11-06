---
"@docker-doctor/cli": minor
---

New rule `no-exposed-unauthenticated-service` warns when a Compose service runs Ollama, Qdrant, or the Docker MCP gateway and publishes a port on all host interfaces without authentication. Bind the port to `127.0.0.1` or reach the service over an internal network.
