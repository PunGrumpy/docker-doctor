---
"@docker-doctor/cli": patch
---

Route every rule through one `FROM` parser. `use-pipefail` carried its own regex, which required each `--flag` to precede the base image and lost the stage name when one followed it, so `FROM base --platform=linux/amd64 AS app` never registered `app` as a stage and later stages built on it stopped inheriting its `SHELL`. It now uses the shared `parseFromArgs`, as `pin-image-version` and `prefer-slim-base` already did, and `collectStageAliases` is built on it too.

The reserved empty base is now recognised the same way everywhere via `isScratch`. `pin-image-version` compared case-sensitively while `use-pipefail` lowercased first, so `FROM SCRATCH` was reported as an image that "does not specify a tag" by one rule and treated as the empty stage by the other. It is treated as the empty stage everywhere now, so that diagnostic no longer appears.
