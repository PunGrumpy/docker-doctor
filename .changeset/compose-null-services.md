---
"@docker-doctor/cli": patch
---

Check services with an empty body. `services: { web: }` was skipped by every Compose rule, so the least-configured service in the file produced zero findings. An empty service now reports missing restart policy, resource limits, and the rest like any other service.
