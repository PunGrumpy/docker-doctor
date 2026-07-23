---
"@docker-doctor/cli": patch
---

Fix image-reference parsing in `pin-image-version` and `prefer-slim-base`, which both used to split on the first `:` and got several common forms wrong:

- Images with a registry port (`myregistry.example.com:5000/team/app`) are no longer mistaken for pinned/tagged just because the port number looks like a tag. `pin-image-version` now correctly flags these as unpinned.
- Digest-pinned images (`node@sha256:...`) are no longer misread as an untagged full-OS image by `prefer-slim-base` — the strongest possible pin is now recognized and silently accepted by both rules.
- Multi-stage build aliases (`FROM builder`, referencing an earlier `FROM ... AS builder`) are no longer flagged as unpinned or non-slim.
- `${ARG}`-driven base images are skipped instead of producing a false diagnostic, since the actual image can't be determined statically.

Image-reference parsing is now handled by a single shared parser (`parseImageRef`/`collectStageAliases` in `@docker-doctor/core`) instead of duplicated ad-hoc string splitting in each rule. Expect diagnostics to change on Dockerfiles that use registry ports, digest pins, or multi-stage aliases as their `FROM` target.
