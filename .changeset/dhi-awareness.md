---
"@docker-doctor/cli": patch
---

Recognize Docker Hardened Images (`dhi.io/…`): `prefer-slim-base` no longer flags them as heavy bases, and `no-root-user` treats their runtime variants as nonroot by default (`-dev` variants still report). Moving to a hardened base no longer costs score points.
