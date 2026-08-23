---
"@docker-doctor/cli": patch
---

Teach `no-root-user` and `avoid-dev-dependencies` about multi-stage inheritance. A stage built `FROM <previous stage>` inherits that stage's image config and layers, but `no-root-user` reset `USER` to root on every `FROM`, reporting a false positive when the parent stage had already dropped privileges, and `avoid-dev-dependencies` audited only the instructions after the last `FROM`, missing dev installs whose layers the final image inherits from a parent stage. Both rules now resolve the stage chain through a shared `parseFromArgs` helper in the image-ref parser.
